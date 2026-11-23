"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { ensureDraft, runDraft } from "@/server/drafting/run";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { prisma } from "@/server/db";
import { setStatus, scorePending } from "@/server/matching/run";
import { llmConfigured } from "@/server/llm";
import { checkTransition } from "@/lib/transitions";
import { APPLICATION_STATUSES, STATUS_STYLE } from "@/lib/status";

export type ActionState = { ok: boolean; message: string } | null;

const ChangeSchema = z.object({
  to: z.enum(APPLICATION_STATUSES),
  reason: z.string().trim().max(500).optional(),
  redirectTo: z.string().startsWith("/").optional(),
});

/** 상태 변경. 전이 규칙은 서버에서만 검증한다 (ARCHITECTURE.md 3절) */
export async function changeStatus(applicationId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = ChangeSchema.safeParse({
    to: fd.get("to"),
    reason: fd.get("reason") || undefined,
    redirectTo: fd.get("redirectTo") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "요청이 올바르지 않아요" };
  const { to, reason, redirectTo } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true } });
  if (!app) return { ok: false, message: "공고를 찾지 못했어요" };
  const check = checkTransition(app.status, to, reason);
  if (!check.ok) return { ok: false, message: check.error };

  try {
    await setStatus(applicationId, app.status, to, { reason: reason ?? null, userId: user.id });
  } catch {
    return { ok: false, message: "그 사이 다른 사람이 상태를 바꿨어요. 새로고침해 주세요" };
  }
  // 진행 결정 → 첨부 받기·초안 쓰기는 응답 뒤에 (ARCHITECTURE.md 6절)
  if (to === "drafting") {
    const draftId = await ensureDraft(applicationId, user.id);
    if (draftId) after(() => runDraft(draftId).catch((e) => console.error("[draft]", e)));
  }
  revalidatePath("/", "layout");
  if (redirectTo) redirect(redirectTo);
  return { ok: true, message: `${STATUS_STYLE[to].label}(으)로 바꿨어요` };
}

/** 상세를 처음 연 사람이 있으면 새 공고 → 검토 전 (PRD 상태 정의) */
export async function markSeen(applicationId: string): Promise<void> {
  const user = await requireUser();
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true } });
  if (app?.status !== "new") return;
  try {
    await setStatus(applicationId, "new", "triage", { userId: user.id });
  } catch {
    // 동시에 누가 바꿨으면 그대로 둔다
  }
  revalidatePath("/", "layout");
}

/** 점수 다시 매기기 (한 건, 바로) */
export async function rescore(matchId: string, _prev: ActionState): Promise<ActionState> {
  await requireUser();
  if (!llmConfigured()) return { ok: false, message: "ANTHROPIC_API_KEY가 없어 점수를 매길 수 없어요" };
  const r = await scorePending({ matchIds: [matchId] });
  revalidatePath("/", "layout");
  if (r.scored) return { ok: true, message: "점수를 다시 매겼어요" };
  const m = await prisma.match.findUnique({ where: { id: matchId }, select: { scoreError: true } });
  return { ok: false, message: m?.scoreError ?? "점수를 매기지 못했어요" };
}
