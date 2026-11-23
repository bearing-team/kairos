"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { refreshMatches, scorePending } from "@/server/matching/run";
import { llmConfigured } from "@/server/llm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { extractFromUrl, type ExtractResult } from "@/server/sources/manual";
import { normalizeUrl } from "@/server/sources/fetchPage";
import { parseKstDate } from "@/server/sources/dates";
import { upsertAnnouncements } from "@/server/sources/upsert";
import { syncAll, SOURCE_LABEL } from "@/server/sources/sync";
import { prisma } from "@/server/db";

// ── 새 공고 가져오기 (API 소싱 즉시 실행) ────────────

export type SyncState = { ok: boolean; message: string } | null;

export async function runSyncNow(_prev: SyncState): Promise<SyncState> {
  await requireUser();
  const results = await syncAll();
  const ran = results.filter((r) => !r.skipped);
  if (ran.length === 0) return { ok: false, message: "API 키가 없어 가져올 수 있는 소스가 없어요" };
  // 규칙 검사는 바로, LLM 점수는 응답을 보낸 뒤 뒤에서 (SCORE_MAX_PER_RUN개씩)
  const refresh = await refreshMatches();
  if (refresh.toScore && llmConfigured()) after(() => scorePending().catch((e) => console.error("[score]", e)));
  revalidatePath("/", "layout");
  const created = ran.reduce((n, r) => n + r.created, 0);
  const failed = ran.filter((r) => !r.ok).map((r) => SOURCE_LABEL[r.source]);
  if (failed.length === ran.length) return { ok: false, message: `${failed.join(", ")} 불러오기에 실패했어요` };
  return {
    ok: failed.length === 0,
    message: `새 공고 ${created}건을 가져왔어요${failed.length ? ` · ${failed.join(", ")}는 실패` : ""}`,
  };
}

// ── URL로 추가 ─────────────────────────────

export type ExtractState = { ok: true; result: ExtractResult } | { ok: false; message: string } | null;

export async function extractUrl(_prev: ExtractState, fd: FormData): Promise<ExtractState> {
  await requireUser();
  const raw = String(fd.get("url") ?? "");
  let url: string;
  try {
    url = normalizeUrl(raw);
  } catch {
    return { ok: false, message: "올바른 주소를 넣어 주세요 (https://로 시작)" };
  }
  const existing = await prisma.announcement.findFirst({ where: { OR: [{ url }, { source: "manual", externalId: url }] }, select: { title: true } });
  if (existing) return { ok: false, message: `이미 있는 공고예요: ${existing.title}` };
  try {
    return { ok: true, result: await extractFromUrl(url) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "페이지를 가져오지 못했어요" };
  }
}

const opt = z
  .string()
  .trim()
  .transform((v) => (v ? v : null));
const date = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseKstDate(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "날짜 형식이 맞지 않아요" });
      return z.NEVER;
    }
    return d;
  });

const manualSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().trim().min(1, "공고명을 입력해 주세요"),
  organization: opt,
  executingOrg: opt,
  summary: opt,
  target: opt,
  regionLimit: opt,
  applyStart: date,
  applyEnd: date,
  applyPeriodText: opt,
  supportAmountText: opt,
  category: opt,
  applyUrl: opt,
});

export type SaveState = { ok: false; message: string; errors?: Record<string, string> } | null;

export async function saveManualAnnouncement(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireUser();
  const parsed = manualSchema.safeParse(Object.fromEntries(Object.keys(manualSchema.shape).map((k) => [k, String(fd.get(k) ?? "")])));
  if (!parsed.success) {
    return { ok: false, message: "입력값을 확인해 주세요", errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  }
  const d = parsed.data;
  if (d.applyStart && d.applyEnd && d.applyStart > d.applyEnd) {
    return { ok: false, message: "입력값을 확인해 주세요", errors: { applyEnd: "마감일이 시작일보다 빨라요" } };
  }
  let url: string;
  try {
    url = normalizeUrl(d.url);
  } catch {
    return { ok: false, message: "주소가 올바르지 않아요" };
  }
  const attachments = fd
    .getAll("attachment")
    .map(String)
    .map((v) => {
      const [href, ...name] = v.split("\t");
      return { url: href, fileName: name.join("\t") || "첨부파일", kind: "other" as const };
    })
    .filter((a) => /^https?:\/\//.test(a.url));

  const saved = await upsertAnnouncements([
    {
      source: "manual",
      externalId: url,
      url,
      title: d.title,
      organization: d.organization,
      executingOrg: d.executingOrg,
      summary: d.summary,
      target: d.target,
      regionLimit: d.regionLimit,
      applyStart: d.applyStart,
      applyEnd: d.applyEnd,
      applyPeriodText: d.applyPeriodText,
      supportAmountText: d.supportAmountText,
      category: d.category,
      hashtags: [],
      applyUrl: d.applyUrl,
      attachments,
      raw: { addedFrom: url },
    },
  ]);
  const newId = saved.createdIds[0];
  if (newId) {
    await refreshMatches({ announcementIds: [newId] });
    if (llmConfigured()) after(() => scorePending().catch((e) => console.error("[score]", e)));
  }
  revalidatePath("/", "layout");
  redirect(newId ? `/announcements/${newId}` : "/announcements?source=manual");
}
