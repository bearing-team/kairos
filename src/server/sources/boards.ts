// 직접 등록한 공고 게시판 확인. server-only를 붙이지 않는다: 워커·pnpm sync(tsx)에서도 쓴다
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/server/db";
import { getLlm, llmConfigured, MODELS } from "@/server/llm";
import { kstDayStart } from "@/lib/kst";
import { BOARD_LIST_PROMPT_VERSION, BOARD_LIST_SYSTEM, BoardListSchema, boardListUserMessage } from "@/server/prompts/board-list.v1";
import { URL_EXTRACT_PROMPT_VERSION } from "@/server/prompts/url-extract.v1";
import { readListPage, type ListLink } from "./boardList";
import { fetchHtml } from "./fetchPage";
import { extractFromUrl } from "./manual";
import { parseKstDate } from "./dates";
import { upsertAnnouncements } from "./upsert";

/** 확인 중 표시가 이보다 오래되면 멈춘 것으로 보고 다시 돌린다 */
export const BOARD_STALE_MS = 15 * 60_000;
const KNOWN_MAX = 3000;
/** 한 번 확인할 때 열어 볼 새 글 수 (글마다 LLM 1회). 나머지는 다음 확인 때 */
export const boardMaxPerRun = () => Math.max(1, Number(process.env.BOARD_MAX_PER_RUN ?? 8) || 8);

export type BoardCheck = {
  boardId: string;
  name: string;
  ok: boolean;
  skipped?: "busy" | "disabled";
  found: number; // 공고로 보여 열어 본 글
  created: number;
  createdIds: string[];
  pending: number; // 다음 확인으로 넘긴 글
  note: string;
  error?: string;
};

export const isChecking = (b: { checkingAt: Date | null }, now = new Date()) => !!b.checkingAt && now.getTime() - b.checkingAt.getTime() < BOARD_STALE_MS;

/** 확인 중 표시를 잡는다 (동시에 두 번 돌지 않게). 화면은 응답 전에 잡아 두고 뒤에서 claimed로 돌린다 */
export async function claimBoard(id: string, now = new Date()): Promise<boolean> {
  const r = await prisma.boardSource.updateMany({
    where: { id, OR: [{ checkingAt: null }, { checkingAt: { lt: new Date(now.getTime() - BOARD_STALE_MS) } }] },
    data: { checkingAt: now },
  });
  return r.count > 0;
}

export class BoardError extends Error {}

/** 목록에서 새 글 링크 중 공고로 보이는 것을 고른다 (LLM). 번호 밖 값은 버린다 */
async function pickAnnouncements(page: { url: string; title: string | null }, fresh: ListLink[]) {
  const response = await getLlm().messages.parse({
    model: MODELS.extract(),
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(BoardListSchema) },
    system: BOARD_LIST_SYSTEM,
    messages: [{ role: "user", content: boardListUserMessage(page, fresh) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new BoardError("게시판 목록을 정리하지 못했어요");
  const out = response.parsed_output;
  const picks = [...new Set(out.picks)].filter((n) => n >= 1 && n <= fresh.length).map((n) => fresh[n - 1]);
  return { isBoard: out.isBoard, picks };
}

function llmMessage(e: unknown) {
  if (e instanceof BoardError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY가 올바르지 않아요";
  if (e instanceof Anthropic.RateLimitError) return "요청이 많아 잠시 뒤에 다시 확인해요";
  if (e instanceof Anthropic.APIError) return `목록 정리 중 오류가 났어요 (${e.status})`;
  return e instanceof Error ? e.message : String(e);
}

/**
 * 게시판 하나 확인: 목록 열기 → 처음 보는 링크만 LLM으로 고르기 → 고른 글을 열어 공고 필드 정리 → 저장.
 * 판단이 끝난 링크는 knownLinks에 넣어 다음엔 보내지 않는다. 글을 열다 실패한 건 남겨 두고 다음에 다시.
 * 매칭(refreshMatches)은 호출한 쪽에서 createdIds로.
 */
export async function checkBoard(id: string, opts: { now?: Date; claimed?: boolean } = {}): Promise<BoardCheck> {
  const now = opts.now ?? new Date();
  const b = await prisma.boardSource.findUniqueOrThrow({ where: { id } });
  const base = { boardId: b.id, name: b.name, found: 0, created: 0, createdIds: [] as string[], pending: 0 };
  if (!opts.claimed && !(await claimBoard(id, now))) return { ...base, ok: false, skipped: "busy", note: "이미 확인하는 중이에요" };

  const run = await prisma.syncRun.create({ data: { source: "board", boardSourceId: id } });
  try {
    if (!llmConfigured()) throw new BoardError("ANTHROPIC_API_KEY가 없어 게시판을 읽을 수 없어요");
    const { url, html } = await fetchHtml(b.url);
    const page = readListPage(html, url);
    if (page.scriptRows >= 3 && page.linkRows < 3) {
      throw new BoardError("글을 스크립트로 여는 게시판이라 자동으로 읽지 못해요. 공고는 한 건씩 주소로 추가해 주세요");
    }

    const known = new Set(b.knownLinks);
    const fresh = page.links.filter((l) => !known.has(l.href));
    const { isBoard, picks } = fresh.length ? await pickAnnouncements(page, fresh) : { isBoard: true, picks: [] };
    if (!isBoard && known.size === 0 && picks.length === 0) throw new BoardError("공고 게시판 목록이 아닌 것 같아요. 글 목록이 보이는 주소를 넣어 주세요");

    const pickedSet = new Set(picks.map((l) => l.href));
    const existing = new Set(
      (await prisma.announcement.findMany({ where: { OR: [{ url: { in: [...pickedSet] } }, { externalId: { in: [...pickedSet] } }] }, select: { url: true, externalId: true } })).flatMap((a) => [a.url, a.externalId]),
    );
    const todo = picks.filter((l) => !existing.has(l.href));
    const batch = todo.slice(0, boardMaxPerRun());
    const settled = [...fresh.filter((l) => !pickedSet.has(l.href)).map((l) => l.href), ...picks.filter((l) => existing.has(l.href)).map((l) => l.href)];

    const today = kstDayStart(now);
    let created = 0;
    let closed = 0;
    let failed = 0;
    const createdIds: string[] = [];
    for (const l of batch) {
      try {
        const ex = await extractFromUrl(l.href);
        if (!ex.fields) {
          failed++; // 정리 실패 → 다음에 다시
          continue;
        }
        settled.push(l.href);
        const f = ex.fields;
        if (!f.isAnnouncement) continue;
        const applyEnd = parseKstDate(f.applyEnd);
        if (applyEnd && applyEnd < today) {
          closed++;
          continue;
        }
        const saved = await upsertAnnouncements(
          [
            {
              source: "board",
              externalId: l.href,
              url: l.href,
              title: f.title ?? l.text,
              organization: f.organization,
              executingOrg: f.executingOrg,
              summary: f.summary,
              target: f.target,
              regionLimit: f.regionLimit,
              applyStart: parseKstDate(f.applyStart),
              applyEnd,
              applyPeriodText: f.applyPeriodText,
              supportAmountText: f.supportAmountText,
              category: f.category,
              hashtags: [],
              applyUrl: f.applyUrl,
              boardSourceId: b.id,
              attachments: ex.page.links.map((a) => ({ url: a.href, fileName: a.text || "첨부파일", kind: "other" as const })),
              raw: { board: b.url, listText: l.context || l.text, prompts: [BOARD_LIST_PROMPT_VERSION, URL_EXTRACT_PROMPT_VERSION] },
            },
          ],
          now,
        );
        created += saved.created;
        createdIds.push(...saved.createdIds);
      } catch {
        failed++;
      }
    }

    const pending = todo.length - batch.length + failed;
    const note = [`새 공고 ${created}건`, closed ? `마감된 글 ${closed}건 건너뜀` : null, pending ? `${pending}건은 다음 확인 때` : null].filter(Boolean).join(" · ");
    const knownLinks = [...known, ...settled.filter((h) => !known.has(h))].slice(-KNOWN_MAX);
    await prisma.boardSource.update({ where: { id }, data: { knownLinks, checkingAt: null, lastCheckedAt: new Date(), lastError: null, lastNote: note } });
    await prisma.syncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), fetched: picks.length, created } });
    return { ...base, ok: true, found: picks.length, created, createdIds, pending, note };
  } catch (e) {
    const error = llmMessage(e);
    await prisma.boardSource.update({ where: { id }, data: { checkingAt: null, lastCheckedAt: new Date(), lastError: error } });
    await prisma.syncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), error } });
    return { ...base, ok: false, note: error, error };
  }
}

/** 켜 둔 게시판을 차례로 확인 */
export async function checkAllBoards(now = new Date()): Promise<BoardCheck[]> {
  const boards = await prisma.boardSource.findMany({ where: { enabled: true }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const out: BoardCheck[] = [];
  for (const b of boards) out.push(await checkBoard(b.id, { now }));
  return out;
}
