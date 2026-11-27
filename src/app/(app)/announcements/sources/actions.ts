"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { prisma } from "@/server/db";
import { llmConfigured } from "@/server/llm";
import { refreshMatches } from "@/server/matching/run";
import { claimBoard } from "@/server/sources/boards";
import { runInBackground } from "@/server/jobs/background";
import { fetchHtml, normalizeUrl } from "@/server/sources/fetchPage";
import { canonicalLink, readListPage } from "@/server/sources/boardList";
import { syncAll, SOURCE_LABEL } from "@/server/sources/sync";
import { importNewsletter } from "@/server/sources/newsletter";

export type SourceState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const PATH = "/announcements/sources";

/** 응답 뒤에서 게시판 확인 → 새 공고 규칙 검사 → 점수 (jobs/handlers.ts) */
const checkInBackground = (id: string) => runInBackground({ kind: "board-check", boardId: id });

export async function addBoard(_prev: SourceState, fd: FormData): Promise<SourceState> {
  await requireUser();
  const rawUrl = String(fd.get("url") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  let url: string;
  try {
    url = canonicalLink(normalizeUrl(rawUrl));
  } catch {
    return { ok: false, message: "입력값을 확인해 주세요", errors: { url: "올바른 주소를 넣어 주세요 (https://로 시작)" } };
  }
  const dup = await prisma.boardSource.findUnique({ where: { url }, select: { name: true } });
  if (dup) return { ok: false, message: "입력값을 확인해 주세요", errors: { url: `이미 연결한 게시판이에요: ${dup.name}` } };

  let title: string | null;
  try {
    const page = await fetchHtml(url);
    const list = readListPage(page.html, page.url);
    if (list.scriptRows >= 3 && list.linkRows < 3) {
      return {
        ok: false,
        message: "입력값을 확인해 주세요",
        errors: { url: "글을 스크립트로 여는 게시판이라 자동으로 읽지 못해요. 공고는 한 건씩 주소로 추가해 주세요" },
      };
    }
    title = list.title;
  } catch (e) {
    return { ok: false, message: "입력값을 확인해 주세요", errors: { url: e instanceof Error ? e.message : "페이지를 열지 못했어요" } };
  }

  const board = await prisma.boardSource.create({
    data: { url, name: (name || title || new URL(url).hostname).slice(0, 80), checkingAt: llmConfigured() ? new Date() : null },
  });
  if (llmConfigured()) await checkInBackground(board.id);
  revalidatePath(PATH);
  return {
    ok: true,
    message: llmConfigured() ? "게시판을 연결했어요. 새 공고를 찾는 중이에요" : "게시판을 연결했어요. ANTHROPIC_API_KEY를 넣으면 공고를 찾기 시작해요",
  };
}

export async function checkBoardNow(id: string): Promise<SourceState> {
  await requireUser();
  if (!llmConfigured()) return { ok: false, message: "ANTHROPIC_API_KEY가 없어 게시판을 읽을 수 없어요" };
  if (!(await claimBoard(id))) return { ok: false, message: "이미 확인하는 중이에요" };
  await checkInBackground(id);
  revalidatePath(PATH);
  return { ok: true, message: "확인을 시작했어요" };
}

export async function setBoardEnabled(id: string, enabled: boolean): Promise<SourceState> {
  await requireUser();
  await prisma.boardSource.update({ where: { id }, data: { enabled } });
  revalidatePath(PATH);
  return { ok: true, message: enabled ? "매일 확인을 다시 켰어요" : "매일 확인을 껐어요" };
}

/** 게시판만 지운다. 이미 가져온 공고는 남긴다 (진행 중인 지원이 있을 수 있음) */
export async function deleteBoard(id: string): Promise<SourceState> {
  await requireUser();
  await prisma.boardSource.delete({ where: { id } });
  revalidatePath(PATH);
  return { ok: true, message: "연결을 끊었어요. 가져온 공고는 그대로 있어요" };
}

/** 기본 API 소스는 지금 가져오고, 켜 둔 게시판은 뒤에서 확인 */
export async function syncEverythingNow(_prev: SourceState): Promise<SourceState> {
  await requireUser();
  const results = (await syncAll()).filter((r) => !r.skipped);
  const refresh = results.some((r) => r.ok) ? await refreshMatches() : null;
  if (refresh?.toScore && llmConfigured()) await runInBackground({ kind: "score-pending" });

  let boards = 0;
  if (llmConfigured()) {
    for (const b of await prisma.boardSource.findMany({ where: { enabled: true }, select: { id: true } })) {
      if (await claimBoard(b.id)) {
        await checkInBackground(b.id);
        boards++;
      }
    }
  }
  revalidatePath("/", "layout");

  const created = results.reduce((n, r) => n + r.created, 0);
  const failed = results.filter((r) => !r.ok).map((r) => SOURCE_LABEL[r.source]);
  const parts = [
    results.length ? `기본 소스에서 새 공고 ${created}건` : null,
    failed.length ? `${failed.join(", ")} 실패` : null,
    boards ? `게시판 ${boards}곳 확인 중` : null,
  ].filter(Boolean);
  if (!parts.length) return { ok: false, message: "가져올 수 있는 소스가 없어요 (API 키·ANTHROPIC_API_KEY 확인)" };
  return { ok: failed.length === 0, message: parts.join(" · ") };
}

/** 뉴스레터 붙여 넣기: 읽어서 바로 저장(수 초) → 규칙 검사 → 점수는 응답 뒤에 */
export async function addNewsletter(_prev: SourceState, fd: FormData): Promise<SourceState & { issueId?: string }> {
  const user = await requireUser();
  const rawUrl = String(fd.get("newsletterUrl") ?? "").trim();
  try {
    normalizeUrl(rawUrl);
  } catch {
    return { ok: false, message: "입력값을 확인해 주세요", errors: { newsletterUrl: "올바른 주소를 넣어 주세요 (https://로 시작)" } };
  }
  let r: Awaited<ReturnType<typeof importNewsletter>>;
  try {
    r = await importNewsletter(rawUrl, user.id);
  } catch (e) {
    console.error("[newsletter]", e);
    return { ok: false, message: "입력값을 확인해 주세요", errors: { newsletterUrl: e instanceof Error ? e.message : "뉴스레터를 읽지 못했어요" } };
  }
  if (r.announcementIds.length) {
    await refreshMatches({ announcementIds: r.announcementIds });
    if (llmConfigured()) await runInBackground({ kind: "score-pending" });
  }
  revalidatePath(PATH);
  revalidatePath("/announcements");
  const c = r.counts;
  return {
    ok: true,
    issueId: r.issueId,
    message: `${r.title} · ${c.total}건 읽음 (새로 ${c.created}건${c.existing ? ` · 이미 있음 ${c.existing}건` : ""})`,
  };
}

export async function deleteNewsletter(id: string): Promise<SourceState> {
  await requireUser();
  // 공고는 남긴다 (진행 중인 상태·초안이 있을 수 있음). 호 기록만 지운다
  await prisma.newsletterIssue.deleteMany({ where: { id } });
  revalidatePath(PATH);
  return { ok: true, message: "지웠어요" };
}
