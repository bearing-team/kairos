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
import { prisma } from "@/server/db";

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
