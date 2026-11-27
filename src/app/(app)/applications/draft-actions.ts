"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { prisma } from "@/server/db";
import { llmConfigured } from "@/server/llm";
import { transition } from "@/server/applications";
import { activeDraft, createDraft } from "@/server/drafting/run";
import { runInBackground } from "@/server/jobs/background";
import { charCount, extractChecks } from "@/lib/needsCheck";

export type DraftActionState = { ok: boolean; message: string } | null;
const STALE_MS = 15 * 60 * 1000;

/** 초안 (다시) 만들기 = 새 버전. 아직 검토 단계면 '초안 작성 중'으로 옮긴다 */
export async function startDraft(applicationId: string, _prev: DraftActionState): Promise<DraftActionState> {
  const user = await requireUser();
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true } });
  if (!app) return { ok: false, message: "공고를 찾지 못했어요" };
  if (app.status === "excluded") return { ok: false, message: "제외한 공고예요. 다시 검토하기를 먼저 눌러 주세요" };
  if (app.status === "new" || app.status === "triage" || app.status === "interested") {
    // 상태를 옮기면 초안이 없을 때 transition이 바로 만든다
    const r = await transition(applicationId, "drafting", { userId: user.id });
    if (!r.ok) return { ok: false, message: r.message };
    if (await activeDraft(applicationId)) {
      revalidatePath("/", "layout");
      return { ok: true, message: "첨부 양식을 받아 초안을 쓰기 시작했어요" };
    }
  }
  const { id, created } = await createDraft(applicationId, user.id);
  if (!created) return { ok: false, message: "초안을 만드는 중이에요. 끝나면 다시 눌러 주세요" };
  await runInBackground({ kind: "draft-run", draftId: id });
  revalidatePath("/", "layout");
  return { ok: true, message: "첨부 양식을 받아 초안을 쓰기 시작했어요" };
}

const SaveSchema = z.object({ content: z.string().max(50_000) });

/** 사람이 고친 본문 저장. 확인 필요 목록은 본문에서 다시 센다 */
export async function saveSection(sectionId: string, _prev: DraftActionState, fd: FormData): Promise<DraftActionState> {
  await requireUser();
  const parsed = SaveSchema.safeParse({ content: String(fd.get("content") ?? "") });
  if (!parsed.success) return { ok: false, message: "본문이 너무 길어요" };
  const s = await prisma.draftSection.findUnique({ where: { id: sectionId }, select: { status: true, updatedAt: true } });
  if (!s) return { ok: false, message: "섹션을 찾지 못했어요" };
  if (s.status === "generating" && Date.now() - s.updatedAt.getTime() < STALE_MS) return { ok: false, message: "AI가 이 섹션을 쓰는 중이에요" };
  const content = parsed.data.content.replace(/\r\n/g, "\n").trim();
  await prisma.draftSection.update({
    where: { id: sectionId },
    data: { content, needsCheck: extractChecks(content), generatedBy: "human", status: content ? "done" : "empty", error: null },
  });
  revalidatePath("/applications/[id]/draft", "page");
  return { ok: true, message: `저장했어요 (${charCount(content).toLocaleString("ko-KR")}자)` };
}

const INSTRUCTIONS = {
  again: undefined,
  detail: "더 구체적으로 써 줘. 회사 프로필과 아이템 카드의 내용을 더 많이 활용하되, 없는 사실은 여전히 【확인 필요: …】로 남겨.",
  shorter: "지금보다 30% 정도 짧게, 핵심만 남겨서 써 줘.",
  criteria: "공고의 평가 기준이 이 섹션에서 더 분명히 드러나게 다시 써 줘.",
} as const;

export async function regenerateSection(sectionId: string, mode: keyof typeof INSTRUCTIONS): Promise<DraftActionState> {
  await requireUser();
  if (!llmConfigured()) return { ok: false, message: "ANTHROPIC_API_KEY가 없어 다시 쓸 수 없어요" };
  if (!(mode in INSTRUCTIONS)) return { ok: false, message: "요청이 올바르지 않아요" };
  const s = await prisma.draftSection.findUnique({ where: { id: sectionId }, select: { draftId: true, status: true, updatedAt: true } });
  if (!s) return { ok: false, message: "섹션을 찾지 못했어요" };
  if (s.status === "generating" && Date.now() - s.updatedAt.getTime() < STALE_MS) return { ok: false, message: "이미 쓰는 중이에요" };
  await prisma.draftSection.update({ where: { id: sectionId }, data: { status: "generating", error: null } });
  await runInBackground({ kind: "draft-sections", draftId: s.draftId, sectionIds: [sectionId], instruction: INSTRUCTIONS[mode] });
  revalidatePath("/applications/[id]/draft", "page");
  return { ok: true, message: "다시 쓰는 중이에요" };
}

/** 비어 있거나 실패한 섹션만 이어서 쓰기 */
export async function generateMissing(draftId: string, _prev: DraftActionState): Promise<DraftActionState> {
  await requireUser();
  if (!llmConfigured()) return { ok: false, message: "ANTHROPIC_API_KEY가 없어 초안을 쓸 수 없어요" };
  const n = await prisma.draftSection.count({ where: { draftId, status: { in: ["empty", "failed"] } } });
  if (!n) return { ok: false, message: "쓸 섹션이 없어요" };
  await prisma.draft.update({ where: { id: draftId }, data: { status: "generating" } });
  await runInBackground({ kind: "draft-sections", draftId });
  revalidatePath("/applications/[id]/draft", "page");
  return { ok: true, message: `${n}개 섹션을 쓰는 중이에요` };
}

const DOC_STATUS = ["ready", "missing", "na"] as const;

export async function setRequiredDocStatus(docId: string, status: (typeof DOC_STATUS)[number]): Promise<void> {
  await requireUser();
  if (!DOC_STATUS.includes(status)) return;
  await prisma.requiredDoc.update({ where: { id: docId }, data: { status } });
  revalidatePath("/", "layout");
}

export async function addRequiredDoc(applicationId: string, _prev: DraftActionState, fd: FormData): Promise<DraftActionState> {
  await requireUser();
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, message: "서류 이름을 넣어 주세요" };
  const order = await prisma.requiredDoc.count({ where: { applicationId } });
  try {
    await prisma.requiredDoc.create({ data: { applicationId, name, source: "manual", order } });
  } catch {
    return { ok: false, message: "이미 있는 서류예요" };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "추가했어요" };
}

export async function removeRequiredDoc(docId: string): Promise<void> {
  await requireUser();
  await prisma.requiredDoc.delete({ where: { id: docId } }).catch(() => undefined);
  revalidatePath("/", "layout");
}

// ── 리뷰 (M5) ───────────────────────────────

const CommentSchema = z.object({ body: z.string().trim().min(1, "내용을 넣어 주세요").max(4000, "너무 길어요") });

export async function addComment(sectionId: string, _prev: DraftActionState, fd: FormData): Promise<DraftActionState> {
  const user = await requireUser();
  const parsed = CommentSchema.safeParse({ body: String(fd.get("body") ?? "") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const s = await prisma.draftSection.findUnique({ where: { id: sectionId }, select: { id: true } });
  if (!s) return { ok: false, message: "섹션을 찾지 못했어요" };
  await prisma.reviewComment.create({ data: { sectionId, authorId: user.id, body: parsed.data.body } });
  revalidatePath("/", "layout");
  return { ok: true, message: "코멘트를 달았어요" };
}

/** 해결 처리 / 다시 열기 (누구나) */
export async function setCommentResolved(commentId: string, resolved: boolean): Promise<void> {
  const user = await requireUser();
  await prisma.reviewComment.update({
    where: { id: commentId },
    data: resolved ? { resolvedAt: new Date(), resolvedById: user.id } : { resolvedAt: null, resolvedById: null },
  });
  revalidatePath("/", "layout");
}

/** 지우기는 쓴 사람만 */
export async function deleteComment(commentId: string): Promise<void> {
  const user = await requireUser();
  await prisma.reviewComment.deleteMany({ where: { id: commentId, authorId: user.id } });
  revalidatePath("/", "layout");
}

export async function setReviewers(applicationId: string, reviewerIds: string[]): Promise<DraftActionState> {
  await requireUser();
  const ids = [...new Set(reviewerIds)].slice(0, 10);
  const found = await prisma.user.count({ where: { id: { in: ids } } });
  if (found !== ids.length) return { ok: false, message: "없는 팀원이 있어요" };
  await prisma.application.update({ where: { id: applicationId }, data: { reviewerIds: ids } });
  revalidatePath("/", "layout");
  return { ok: true, message: "리뷰어를 바꿨어요" };
}

/** 양식 채우기 초안: 칸 값을 한꺼번에 저장 (f:<섹션 id> = 값, 고르는 칸은 여러 번) */
export async function saveFormFields(draftId: string, _prev: DraftActionState, fd: FormData): Promise<DraftActionState> {
  await requireUser();
  const sections = await prisma.draftSection.findMany({ where: { draftId }, select: { id: true, content: true, status: true, updatedAt: true, field: true } });
  if (sections.some((s) => s.status === "generating" && Date.now() - s.updatedAt.getTime() < STALE_MS)) return { ok: false, message: "AI가 칸을 채우는 중이에요. 끝나면 저장해 주세요" };
  let changed = 0;
  for (const s of sections) {
    const meta = s.field as { kind?: string; options?: string[] } | null;
    const raw = fd.getAll(`f:${s.id}`).map((v) => String(v));
    const content = (meta?.kind === "choice" ? raw.filter((v) => meta.options?.includes(v)).join(", ") : (raw[0] ?? "")).replace(/\r\n/g, "\n").trim().slice(0, 5000);
    if (content === s.content) continue;
    changed++;
    await prisma.draftSection.update({
      where: { id: s.id },
      data: { content, needsCheck: content ? [] : ["비어 있어요"], generatedBy: "human", status: "done", error: null },
    });
  }
  revalidatePath("/applications/[id]/draft", "page");
  return { ok: true, message: changed ? `${changed}칸을 저장했어요` : "바뀐 칸이 없어요" };
}
