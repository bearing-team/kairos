import "server-only";
import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { kstDayStart } from "@/lib/kst";
import { FOCUS_STATUSES, HERO_STATUSES, IN_PROGRESS } from "@/lib/transitions";
import type { ApplicationStatus, Prisma } from "@/generated/prisma/client";

const DAY = 86_400_000;

/** 접수 중이거나 시작 전, 또는 날짜 없음. 다른 소스의 중복은 빼고 대표 공고만 */
export function openAnnouncementWhere(now: Date): Prisma.AnnouncementWhereInput {
  return { duplicateOfId: null, OR: [{ applyEnd: null }, { applyEnd: { gte: kstDayStart(now) } }] };
}

/** 리스트 행·카드에 필요한 필드 */
export const rowSelect = {
  id: true,
  status: true,
  excludedReason: true,
  autoExcluded: true,
  createdAt: true,
  reviewerIds: true,
  match: { select: { score: true, scoreStatus: true, eligibility: true, reasons: true, excludeReason: true } },
  announcement: {
    select: {
      id: true, source: true, title: true, organization: true, executingOrg: true, supportAmountText: true,
      regionLimit: true, applyStart: true, applyEnd: true, url: true, firstSeenAt: true,
      _count: { select: { duplicates: true } },
    },
  },
} satisfies Prisma.ApplicationSelect;
export type AppRow = Prisma.ApplicationGetPayload<{ select: typeof rowSelect }>;

const byScore: Prisma.ApplicationOrderByWithRelationInput[] = [
  { match: { score: { sort: "desc", nulls: "last" } } },
  { announcement: { applyEnd: { sort: "asc", nulls: "last" } } },
];

export const HOME_TABS = ["all", "new", "progress", "excluded"] as const;
export type HomeTab = (typeof HOME_TABS)[number];
const TAB_STATUSES: Record<HomeTab, ApplicationStatus[]> = {
  all: ["new", ...IN_PROGRESS],
  new: ["new"],
  progress: IN_PROGRESS,
  excluded: ["excluded"],
};
const HOME_LIST_LIMIT = 20;

export async function getHomeData(tab: HomeTab, now = new Date()) {
  const company = await getCompany();
  const open = openAnnouncementWhere(now);
  const base = { companyId: company.id, announcement: open } satisfies Prisma.ApplicationWhereInput;
  const weekEnd = new Date(kstDayStart(now).getTime() + 8 * DAY); // D-7까지

  const [todayNew, focusCount, hero, counts] = await Promise.all([
    prisma.announcement.count({ where: { duplicateOfId: null, firstSeenAt: { gte: kstDayStart(now) } } }),
    prisma.application.count({
      where: {
        ...base,
        status: { in: FOCUS_STATUSES },
        OR: [{ announcement: { applyEnd: { lt: weekEnd } } }, { match: { score: { gte: 85 } } }],
      },
    }),
    prisma.application.findFirst({
      where: { ...base, status: { in: HERO_STATUSES }, match: { score: { not: null } } },
      orderBy: byScore,
      select: { ...rowSelect, match: { select: { ...rowSelect.match.select, risks: true } } },
    }),
    prisma.application.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);

  const heroId = hero?.id;
  const [urgent, fresh] = await Promise.all([
    prisma.application.findFirst({
      where: { ...base, status: { in: ["drafting", "review"] }, announcement: { ...open, applyEnd: { not: null } }, ...(heroId ? { id: { not: heroId } } : {}) },
      orderBy: { announcement: { applyEnd: "asc" } },
      select: rowSelect,
    }),
    prisma.application.findFirst({
      where: { ...base, status: "new", createdAt: { gte: new Date(now.getTime() - DAY) }, match: { score: { not: null } }, ...(heroId ? { id: { not: heroId } } : {}) },
      orderBy: byScore,
      select: rowSelect,
    }),
  ]);

  // 리스트: "전체"는 진행 가능한 것 먼저, 남는 자리에 제외된 것 (B안처럼 흐리게 맨 아래)
  const list = await prisma.application.findMany({ where: { ...base, status: { in: TAB_STATUSES[tab] } }, orderBy: byScore, take: HOME_LIST_LIMIT, select: rowSelect });
  if (tab === "all" && list.length < HOME_LIST_LIMIT) {
    list.push(...(await prisma.application.findMany({ where: { ...base, status: "excluded" }, orderBy: byScore, take: Math.min(5, HOME_LIST_LIMIT - list.length), select: rowSelect })));
  }

  const n = (ss: ApplicationStatus[]) => counts.filter((c) => ss.includes(c.status)).reduce((s, c) => s + c._count._all, 0);
  const tabCounts: Record<HomeTab, number> = {
    all: n([...TAB_STATUSES.all, "excluded"]),
    new: n(TAB_STATUSES.new),
    progress: n(TAB_STATUSES.progress),
    excluded: n(TAB_STATUSES.excluded),
  };

  const reviewerIds = [...new Set(urgent?.reviewerIds ?? [])];
  const reviewers = reviewerIds.length ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true, email: true } }) : [];

  return { todayNew, focusCount, hero, urgent, fresh, list, tabCounts, reviewers, listLimit: HOME_LIST_LIMIT };
}

/** 사이드바 "초안·리뷰" 배지 = 리뷰 대기 수 */
export async function reviewWaitingCount() {
  const company = await getCompany();
  return prisma.application.count({ where: { companyId: company.id, status: "review" } });
}

export async function getAnnouncementDetail(id: string) {
  const company = await getCompany();
  const a = await prisma.announcement.findUnique({
    where: { id },
    include: {
      attachments: { orderBy: { fileName: "asc" } },
      duplicateOf: { select: { id: true } },
      duplicates: { select: { id: true, source: true, url: true } },
      matches: { where: { companyId: company.id } },
      applications: {
        where: { companyId: company.id },
        include: { events: { orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true, email: true } } } } },
      },
    },
  });
  if (!a) return null;
  const match = a.matches[0] ?? null;
  const card = match?.suggestedItemCardId ? await prisma.itemCard.findUnique({ where: { id: match.suggestedItemCardId }, select: { id: true, name: true } }) : null;
  return { a, match, application: a.applications[0] ?? null, suggestedCard: card };
}

/** 점수 대기 중인 수 (화면 안내용) */
export async function scoreBacklog(now = new Date()) {
  const company = await getCompany();
  return prisma.match.count({
    where: { companyId: company.id, hardFilterPassed: true, scoreStatus: { in: ["pending", "running"] }, announcement: openAnnouncementWhere(now) },
  });
}
