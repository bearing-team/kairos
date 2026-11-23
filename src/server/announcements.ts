import "server-only";
import { prisma } from "@/server/db";
import type { AnnouncementSource, Prisma } from "@/generated/prisma/client";
import { kstYmd } from "@/lib/kst";

export type ListFilter = { q?: string; source?: AnnouncementSource; sort?: "deadline" | "recent"; includeClosed?: boolean; page?: number };
export const PAGE_SIZE = 50;

/** 오늘(KST) 00:00 — applyEnd(그날 KST 자정)가 이보다 작으면 마감 */
function kstTodayStart(now: Date) {
  const { year, month, day } = kstYmd(now);
  return new Date(Date.UTC(year, month - 1, day) - 9 * 3600e3);
}

export function baseWhere(f: Pick<ListFilter, "q" | "includeClosed">, now: Date): Prisma.AnnouncementWhereInput {
  const and: Prisma.AnnouncementWhereInput[] = [{ duplicateOfId: null }];
  if (!f.includeClosed) and.push({ OR: [{ applyEnd: null }, { applyEnd: { gte: kstTodayStart(now) } }] });
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
  const where = baseWhere(f, now);
  const page = Math.max(1, f.page ?? 1);
  const [items, total, bySource] = await Promise.all([
    prisma.announcement.findMany({
      where: f.source ? { AND: [where, { source: f.source }] } : where,
      orderBy:
        f.sort === "recent"
          ? [{ firstSeenAt: "desc" }]
          : [{ applyEnd: { sort: "asc", nulls: "last" } }, { firstSeenAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        source: true,
        title: true,
        organization: true,
        executingOrg: true,
        supportAmountText: true,
        regionLimit: true,
        applyStart: true,
        applyEnd: true,
        url: true,
        firstSeenAt: true,
        _count: { select: { duplicates: true } },
      },
    }),
    prisma.announcement.count({ where: f.source ? { AND: [where, { source: f.source }] } : where }),
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
