import "server-only";
import { prisma } from "@/server/db";
import { setStatus } from "@/server/matching/run";
import { ensureDraft } from "@/server/drafting/run";
import { runInBackground } from "@/server/jobs/background";
import { checkTransition } from "@/lib/transitions";
import type { ApplicationStatus } from "@/lib/status";

export type TransitionResult = { ok: true; from: ApplicationStatus } | { ok: false; message: string };

/**
 * 상태 변경 + 따라오는 일. 상태 버튼·보드 드래그가 같이 쓴다 (서버에서만 검증)
 * - drafting: 담당자 없으면 바꾼 사람, 초안이 없으면 만들기(응답 뒤)
 * - review: 리뷰 요청 Slack (응답 뒤, Slack 설정이 있을 때만)
 */
export async function transition(applicationId: string, to: ApplicationStatus, opts: { userId: string; reason?: string | null; expectFrom?: ApplicationStatus }): Promise<TransitionResult> {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true, ownerId: true } });
  if (!app) return { ok: false, message: "공고를 찾지 못했어요" };
  if (opts.expectFrom && app.status !== opts.expectFrom) return { ok: false, message: "그 사이 다른 사람이 상태를 바꿨어요" };
  const check = checkTransition(app.status, to, opts.reason ?? undefined);
  if (!check.ok) return { ok: false, message: check.error };
  try {
    await setStatus(applicationId, app.status, to, { reason: opts.reason ?? null, userId: opts.userId });
  } catch {
    return { ok: false, message: "그 사이 다른 사람이 상태를 바꿨어요. 새로고침해 주세요" };
  }
  if (to === "drafting") {
    if (!app.ownerId) await prisma.application.update({ where: { id: applicationId }, data: { ownerId: opts.userId } });
    const draftId = await ensureDraft(applicationId, opts.userId);
    if (draftId) await runInBackground({ kind: "draft-run", draftId });
  }
  if (to === "review" && app.status === "drafting") {
    await runInBackground({ kind: "review-request", applicationId, userId: opts.userId });
  }
  return { ok: true, from: app.status };
}
