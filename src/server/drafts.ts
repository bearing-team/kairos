import "server-only";
import { prisma } from "@/server/db";

const STALE_MS = 15 * 60 * 1000;

export async function getDraftPage(applicationId: string, version?: number) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      companyId: true,
      status: true,
      ownerId: true,
      reviewerIds: true,
      announcement: {
        select: {
          id: true,
          title: true,
          organization: true,
          applyStart: true,
          applyEnd: true,
          url: true,
          attachments: { orderBy: { fileName: "asc" }, select: { id: true, fileName: true, url: true, kind: true, parseStatus: true, parseError: true, fileKey: true, parsed: true } },
        },
      },
      requiredDocs: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      drafts: { orderBy: { version: "desc" }, select: { id: true, version: true, status: true, createdAt: true } },
    },
  });
  if (!app) return null;
  const pick = version ? app.drafts.find((d) => d.version === version) : app.drafts[0];
  const draft = pick
    ? await prisma.draft.findUnique({
        where: { id: pick.id },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              comments: {
                orderBy: { createdAt: "asc" },
                include: { author: { select: { id: true, name: true, email: true } }, resolvedBy: { select: { name: true, email: true } } },
              },
            },
          },
          formAttachment: { select: { fileName: true } },
          createdBy: { select: { name: true, email: true } },
        },
      })
    : null;
  const now = Date.now();
  const stale = (d: Date) => now - d.getTime() > STALE_MS;
  // 서버가 중간에 꺼져 멈춘 작업은 실패로 보여준다
  const sections = draft?.sections.map((s) => (s.status === "generating" && stale(s.updatedAt) ? { ...s, status: "failed" as const, error: "중간에 멈췄어요. 다시 써 주세요" } : s));
  const draftStatus = draft && (draft.status === "preparing" || draft.status === "generating") && stale(draft.updatedAt) && !sections?.some((s) => s.status === "generating") ? "failed" : draft?.status;
  // 리뷰어 후보 = 같은 회사의 가입한 구성원 (+ 예전에 지정된 리뷰어는 그대로 보이게)
  const users = await prisma.user.findMany({
    where: { OR: [{ companyId: app.companyId, passwordHash: { not: null } }, { id: { in: app.reviewerIds } }] },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });
  return { app, users, draft: draft ? { ...draft, status: draftStatus!, sections: sections! } : null };
}

/** 상세·홈에서 쓰는 초안 진행 (최신 버전) */
export async function draftProgress(applicationIds: string[]) {
  if (!applicationIds.length) return new Map<string, { done: number; total: number; checks: number; status: string }>();
  const drafts = await prisma.draft.findMany({
    where: { applicationId: { in: applicationIds } },
    orderBy: { version: "desc" },
    distinct: ["applicationId"],
    select: { applicationId: true, status: true, sections: { select: { status: true, needsCheck: true } } },
  });
  return new Map(
    drafts.map((d) => [
      d.applicationId,
      { done: d.sections.filter((s) => s.status === "done").length, total: d.sections.length, checks: d.sections.reduce((n, s) => n + s.needsCheck.length, 0), status: d.status },
    ]),
  );
}
