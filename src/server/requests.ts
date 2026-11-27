import "server-only";
import { prisma } from "@/server/db";
import { runInBackground } from "@/server/jobs/background";
import { kstDayStart } from "@/lib/kst";
import type { CurrentUser } from "@/server/session";
import type { RequestKind } from "@/lib/requests";
import type { Prisma } from "@/generated/prisma/client";

export type RequestResult = { ok: true; id?: string } | { ok: false; message: string };

/** 같은 회사 구성원 (비밀번호가 있는 = 가입한 사람만) */
export function companyMembers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId, passwordHash: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      slackUserId: true,
      createdAt: true,
    },
  });
}

/** 요청 보내기. 받는 사람·지원·섹션이 모두 내 회사 것인지 서버에서 확인한다 */
export async function createRequest(
  me: CurrentUser,
  input: {
    applicationId: string;
    toId: string;
    kind: RequestKind;
    sectionId: string | null;
    message: string;
    due: string | null;
  },
): Promise<RequestResult> {
  if (input.toId === me.id) return { ok: false, message: "나에게는 요청할 수 없어요" };
  const [app, to] = await Promise.all([
    prisma.application.findUnique({
      where: { id: input.applicationId },
      select: { id: true, companyId: true, reviewerIds: true },
    }),
    prisma.user.findUnique({
      where: { id: input.toId },
      select: { companyId: true, passwordHash: true },
    }),
  ]);
  if (!app || app.companyId !== me.companyId) return { ok: false, message: "공고를 찾지 못했어요" };
  if (!to || to.companyId !== me.companyId || !to.passwordHash) return { ok: false, message: "같은 회사 구성원에게만 요청할 수 있어요" };

  let sectionTitle: string | null = null;
  if (input.sectionId) {
    const sec = await prisma.draftSection.findUnique({
      where: { id: input.sectionId },
      select: { title: true, draft: { select: { applicationId: true } } },
    });
    if (!sec || sec.draft.applicationId !== app.id) return { ok: false, message: "섹션을 찾지 못했어요" };
    sectionTitle = sec.title;
  }

  let dueAt: Date | null = null;
  if (input.due) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.due);
    if (!m) return { ok: false, message: "기한 형식이 올바르지 않아요" };
    // KST 그날 23:59:59까지
    dueAt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1) - 9 * 3600e3 - 1000);
    if (dueAt < kstDayStart(new Date())) return { ok: false, message: "기한이 이미 지났어요" };
  }

  const created = await prisma.workRequest.create({
    data: {
      companyId: me.companyId,
      applicationId: app.id,
      sectionId: input.sectionId,
      sectionTitle,
      kind: input.kind,
      fromId: me.id,
      toId: input.toId,
      message: input.message,
      dueAt,
    },
    select: { id: true },
  });
  // 리뷰 요청이면 리뷰어로도 지정 (보드·홈의 리뷰어 표시와 맞춘다)
  if (input.kind === "review" && !app.reviewerIds.includes(input.toId)) {
    await prisma.application.update({
      where: { id: app.id },
      data: { reviewerIds: [...app.reviewerIds, input.toId] },
    });
  }
  await runInBackground({ kind: "work-request", requestId: created.id });
  return { ok: true, id: created.id };
}

/** 받은 사람: 완료·거절 / 보낸 사람: 취소 / 끝난 요청 다시 열기는 보낸 사람·받은 사람 모두 */
export async function updateRequest(me: CurrentUser, id: string, action: "done" | "declined" | "canceled" | "reopen", reply: string | null): Promise<RequestResult> {
  const r = await prisma.workRequest.findUnique({
    where: { id },
    select: { companyId: true, fromId: true, toId: true, status: true },
  });
  if (!r || r.companyId !== me.companyId) return { ok: false, message: "요청을 찾지 못했어요" };
  if (action === "reopen") {
    if (r.status === "open") return { ok: true };
    if (me.id !== r.fromId && me.id !== r.toId)
      return {
        ok: false,
        message: "보낸 사람이나 받은 사람만 다시 열 수 있어요",
      };
    await prisma.workRequest.update({
      where: { id },
      data: { status: "open", reply: null, respondedAt: null },
    });
    return { ok: true };
  }
  if (r.status !== "open") return { ok: false, message: "이미 끝난 요청이에요" };
  if (action === "canceled" ? me.id !== r.fromId : me.id !== r.toId) {
    return {
      ok: false,
      message: action === "canceled" ? "보낸 사람만 취소할 수 있어요" : "받은 사람만 완료·거절할 수 있어요",
    };
  }
  if (action === "declined" && !reply) return { ok: false, message: "거절 사유를 한 줄 남겨 주세요" };
  // 동시에 두 번 눌러도 한 번만 바뀌게 status 조건을 같이 건다
  const n = await prisma.workRequest.updateMany({
    where: { id, status: "open" },
    data: { status: action, reply, respondedAt: new Date() },
  });
  return n.count ? { ok: true } : { ok: false, message: "그 사이 상태가 바뀌었어요. 새로고침해 주세요" };
}

const requestSelect = {
  id: true,
  kind: true,
  status: true,
  message: true,
  reply: true,
  dueAt: true,
  respondedAt: true,
  createdAt: true,
  applicationId: true,
  sectionTitle: true,
  section: { select: { order: true, draft: { select: { version: true } } } },
  from: { select: { id: true, name: true, email: true } },
  to: { select: { id: true, name: true, email: true } },
  application: {
    select: {
      status: true,
      announcement: {
        select: { id: true, title: true, applyStart: true, applyEnd: true },
      },
    },
  },
} satisfies Prisma.WorkRequestSelect;

export type RequestRow = Prisma.WorkRequestGetPayload<{
  select: typeof requestSelect;
}>;

/** 요청함: 받은/보낸 × 진행 중/끝남. 진행 중은 기한 가까운 순, 끝난 건 최근 순 */
export async function listRequests(me: CurrentUser, box: "received" | "sent", state: "open" | "closed", take = 100) {
  const who: Prisma.WorkRequestWhereInput = box === "received" ? { toId: me.id } : { fromId: me.id };
  const where: Prisma.WorkRequestWhereInput = {
    companyId: me.companyId,
    ...who,
    status: state === "open" ? "open" : { not: "open" },
  };
  const rows = await prisma.workRequest.findMany({
    where,
    take,
    orderBy: state === "open" ? [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }] : [{ respondedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    select: requestSelect,
  });
  const counts = await prisma.workRequest.groupBy({
    by: ["toId", "fromId"],
    where: {
      companyId: me.companyId,
      status: "open",
      OR: [{ toId: me.id }, { fromId: me.id }],
    },
    _count: true,
  });
  const received = counts.filter((c) => c.toId === me.id).reduce((n, c) => n + c._count, 0);
  const sent = counts.filter((c) => c.fromId === me.id).reduce((n, c) => n + c._count, 0);
  return { rows, counts: { received, sent } };
}

/** 사이드바 배지: 나에게 온 진행 중 요청 */
export function openReceivedCount(me: CurrentUser) {
  return prisma.workRequest.count({
    where: { companyId: me.companyId, toId: me.id, status: "open" },
  });
}

/** 초안 화면: 이 지원에 걸린 요청 (진행 중 먼저, 최근 끝난 것 몇 개) */
export async function applicationRequests(me: CurrentUser, applicationId: string) {
  const [open, closed] = await Promise.all([
    prisma.workRequest.findMany({
      where: { companyId: me.companyId, applicationId, status: "open" },
      orderBy: { createdAt: "desc" },
      select: requestSelect,
    }),
    prisma.workRequest.findMany({
      where: {
        companyId: me.companyId,
        applicationId,
        status: { not: "open" },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: requestSelect,
    }),
  ]);
  return { open, closed };
}
