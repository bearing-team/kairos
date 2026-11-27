import "server-only";
import { prisma } from "@/server/db";
import type { AnnouncementSource, ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { getCompany } from "@/server/company";
import { rowSelect } from "@/server/matches";
import { kstDayStart } from "@/lib/kst";

export const LIST_STATUS = {
  active: ["new", "triage", "interested", "drafting", "review"],
  new: ["new"],
  /** 1차 분류 전: 여기서 관심 / 관심 없음으로 나눈다 */
  unsorted: ["new", "triage"],
  interested: ["interested"],
  progress: ["drafting", "review"],
  done: ["submitted", "result_pass", "result_fail"],
  excluded: ["excluded"],
} satisfies Record<string, ApplicationStatus[]>;
export type ListStatus = keyof typeof LIST_STATUS;

export type ListFilter = {
  q?: string;
  source?: AnnouncementSource;
  status?: ListStatus;
  sort?: "score" | "deadline" | "recent";
  includeClosed?: boolean;
  page?: number;
};
export const PAGE_SIZE = 50;


export function baseWhere(f: Pick<ListFilter, "q" | "includeClosed">, now: Date): Prisma.AnnouncementWhereInput {
  const and: Prisma.AnnouncementWhereInput[] = [{ duplicateOfId: null }];
  if (!f.includeClosed) and.push({ OR: [{ applyEnd: null }, { applyEnd: { gte: kstDayStart(now) } }] });
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { organization: { contains: q, mode: "insensitive" } },
        { executingOrg: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

export async function listAnnouncements(f: ListFilter, now = new Date()) {
  const company = await getCompany();
  const where = baseWhere(f, now);
  const page = Math.max(1, f.page ?? 1);
  const appWhere: Prisma.ApplicationWhereInput = {
    companyId: company.id,
    announcement: f.source ? { AND: [where, { source: f.source }] } : where,
    ...(f.status ? { status: { in: LIST_STATUS[f.status] } } : {}),
  };
  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
    f.sort === "recent"
      ? [{ announcement: { firstSeenAt: "desc" } }]
      : f.sort === "deadline"
        ? [{ announcement: { applyEnd: { sort: "asc", nulls: "last" } } }, { match: { score: { sort: "desc", nulls: "last" } } }]
        : [{ match: { score: { sort: "desc", nulls: "last" } } }, { announcement: { applyEnd: { sort: "asc", nulls: "last" } } }];
  const [items, total, bySource, byStatus] = await Promise.all([
    prisma.application.findMany({ where: appWhere, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: rowSelect }),
    prisma.application.count({ where: appWhere }),
    prisma.announcement.groupBy({ by: ["source"], where, _count: { _all: true } }),
    // 상태 탭 숫자 (소스 필터·검색은 따른다)
    prisma.application.groupBy({ by: ["status"], where: { companyId: company.id, announcement: appWhere.announcement }, _count: { _all: true } }),
  ]);
  const statusCounts = Object.fromEntries(
    (Object.keys(LIST_STATUS) as ListStatus[]).map((k) => [
      k,
      byStatus.filter((r) => (LIST_STATUS[k] as ApplicationStatus[]).includes(r.status)).reduce((n, r) => n + r._count._all, 0),
    ]),
  ) as Record<ListStatus, number>;
  const counts = Object.fromEntries(bySource.map((r) => [r.source, r._count._all])) as Partial<Record<AnnouncementSource, number>>;
  const all = bySource.reduce((n, r) => n + r._count._all, 0);
  return { items, total, counts, statusCounts, all, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** 소스별 마지막 실행 + 마지막 성공 이후 실패 여부 */
export async function syncStatus() {
  const runs = await prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  const lastSuccess = runs.find((r) => !r.error && r.finishedAt);
  const failing = (["bizinfo", "kstartup"] as const).filter((s) => {
    const latest = runs.find((r) => r.source === s && r.finishedAt);
    return latest?.error;
  });
  return { lastSuccessAt: lastSuccess?.finishedAt ?? null, failing };
}

/**
 * 1차 분류 대기열: 분류 전(new·triage) + 마감 안 된 대표 공고, 공고 목록 "분류 전" 탭 기본 정렬(적합도 → 마감)과 같은 순서.
 * 상세 화면의 분류 바가 "지금 몇 번째 / 다음 공고"를 여기서 얻는다
 */
export async function unsortedQueue(now = new Date()) {
  const company = await getCompany();
  const rows = await prisma.application.findMany({
    where: {
      companyId: company.id,
      status: { in: LIST_STATUS.unsorted },
      announcement: baseWhere({}, now),
    },
    orderBy: [{ match: { score: { sort: "desc", nulls: "last" } } }, { announcement: { applyEnd: { sort: "asc", nulls: "last" } } }, { id: "asc" }],
    select: { announcementId: true },
  });
  return rows.map((r) => r.announcementId);
}
