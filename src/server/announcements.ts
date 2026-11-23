import "server-only";
import { prisma } from "@/server/db";
import type { AnnouncementSource, ApplicationStatus, Prisma } from "@/generated/prisma/client";
import { getCompany } from "@/server/company";
import { rowSelect } from "@/server/matches";
import { kstDayStart } from "@/lib/kst";

export const LIST_STATUS = {
  active: ["new", "triage", "drafting", "review"],
  new: ["new"],
  progress: ["triage", "drafting", "review"],
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
  const [items, total, bySource] = await Promise.all([
    prisma.application.findMany({ where: appWhere, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: rowSelect }),
    prisma.application.count({ where: appWhere }),
    prisma.announcement.groupBy({ by: ["source"], where, _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(bySource.map((r) => [r.source, r._count._all])) as Partial<Record<AnnouncementSource, number>>;
  const all = bySource.reduce((n, r) => n + r._count._all, 0);
  return { items, total, counts, all, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
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
