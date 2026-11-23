"use server";

import { revalidatePath } from "next/cache";
import { withRo } from "@/lib/format";
import { redirect } from "next/navigation";
import { transition } from "@/server/applications";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { prisma } from "@/server/db";
import { setStatus, scorePending } from "@/server/matching/run";
import { llmConfigured } from "@/server/llm";
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

  const r = await transition(applicationId, to, { userId: user.id, reason: reason ?? null });
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/", "layout");
  if (redirectTo) redirect(redirectTo);
  return { ok: true, message: `${withRo(STATUS_STYLE[to].label)} 바꿨어요` };
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

/** 보드 드래그로 옮기기. expectFrom이 다르면(그 사이 바뀜) 실패 → 원위치 */
export async function moveCard(applicationId: string, from: string, to: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ from: z.enum(APPLICATION_STATUSES), to: z.enum(APPLICATION_STATUSES) }).safeParse({ from, to });
  if (!parsed.success) return { ok: false, message: "요청이 올바르지 않아요" };
  const r = await transition(applicationId, parsed.data.to, { userId: user.id, expectFrom: parsed.data.from });
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `${withRo(STATUS_STYLE[parsed.data.to].label)} 옮겼어요` };
}
