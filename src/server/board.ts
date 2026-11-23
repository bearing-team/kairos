import "server-only";
import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { openAnnouncementWhere } from "@/server/matches";
import { draftProgress } from "@/server/drafts";
import { ddayLabel, timeline, type Timeline } from "@/lib/dday";
import { kstYmd } from "@/lib/kst";
import type { ApplicationStatus } from "@/lib/status";
import type { Prisma } from "@/generated/prisma/client";

export const BOARD_COLUMNS = [
  { key: "recommended", label: "추천됨", dropStatus: "triage", dot: "var(--status-new-dot)" },
  { key: "drafting", label: "초안 작성", dropStatus: "drafting", dot: "var(--status-drafting-dot)" },
  { key: "review", label: "리뷰", dropStatus: "review", dot: "var(--status-review-dot)" },
  { key: "submitted", label: "제출 완료", dropStatus: "submitted", dot: "var(--status-submitted-dot)" },
] as const satisfies readonly { key: string; label: string; dropStatus: ApplicationStatus; dot: string }[];
export type BoardColumnKey = (typeof BOARD_COLUMNS)[number]["key"];

export type BoardCard = {
  id: string;
  status: ApplicationStatus;
  announcementId: string;
  title: string;
  organization: string | null;
  score: number | null;
  t: Timeline;
  /** 카드 아래 왼쪽 글자: "12.01 접수 시작" / "D-15" / "11.14 제출" */
  dday: string;
  /** 기관 뒤에 붙는 상태: "결과 대기" / "선정" / "미선정" */
  outcome: string | null;
  progress: { done: number; total: number } | null;
  openComments: number;
  people: { id: string; name: string | null; email: string | null }[];
};

const RECOMMENDED_LIMIT = 12;
const SUBMITTED: ApplicationStatus[] = ["submitted", "result_pass", "result_fail"];
const SUBMITTED_DAYS = 60;

const select = {
  id: true,
  status: true,
  ownerId: true,
  reviewerIds: true,
  submittedAt: true,
  statusChangedAt: true,
  match: { select: { score: true } },
  announcement: { select: { id: true, title: true, organization: true, applyStart: true, applyEnd: true } },
} satisfies Prisma.ApplicationSelect;

export async function getBoard(now = new Date()) {
  const company = await getCompany();
  const base = { companyId: company.id };
  const [recommended, recommendedTotal, drafting, review, submitted, users, submittedThisMonth] = await Promise.all([
    prisma.application.findMany({
      where: { ...base, status: { in: ["new", "triage"] }, match: { hardFilterPassed: true }, announcement: openAnnouncementWhere(now) },
      orderBy: [{ match: { score: { sort: "desc", nulls: "last" } } }, { announcement: { applyEnd: { sort: "asc", nulls: "last" } } }],
      take: RECOMMENDED_LIMIT,
      select,
    }),
    prisma.application.count({ where: { ...base, status: { in: ["new", "triage"] }, match: { hardFilterPassed: true }, announcement: openAnnouncementWhere(now) } }),
    prisma.application.findMany({ where: { ...base, status: "drafting" }, orderBy: { announcement: { applyEnd: { sort: "asc", nulls: "last" } } }, select }),
    prisma.application.findMany({ where: { ...base, status: "review" }, orderBy: { announcement: { applyEnd: { sort: "asc", nulls: "last" } } }, select }),
    prisma.application.findMany({
      where: { ...base, status: { in: ["submitted", "result_pass", "result_fail"] }, statusChangedAt: { gte: new Date(now.getTime() - SUBMITTED_DAYS * 86_400_000) } },
      orderBy: { statusChangedAt: "desc" },
      select,
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    countSubmittedThisMonth(company.id, now),
  ]);

  const inProgress = [...drafting, ...review];
  const progress = await draftProgress(inProgress.map((a) => a.id));
  const comments = inProgress.length
    ? await prisma.reviewComment.groupBy({
        by: ["sectionId"],
        where: { resolvedAt: null, section: { draft: { applicationId: { in: inProgress.map((a) => a.id) } } } },
        _count: true,
      })
    : [];
  // 섹션 → 진행 id (최신 버전만 세면 좋지만, 열린 코멘트는 이전 버전 것도 알려 준다)
  const sectionApp = comments.length
    ? new Map(
        (await prisma.draftSection.findMany({ where: { id: { in: comments.map((c) => c.sectionId) } }, select: { id: true, draft: { select: { applicationId: true } } } })).map((s) => [s.id, s.draft.applicationId]),
      )
    : new Map<string, string>();
  const openByApp = new Map<string, number>();
  for (const c of comments) {
    const appId = sectionApp.get(c.sectionId);
    if (appId) openByApp.set(appId, (openByApp.get(appId) ?? 0) + c._count);
  }

  const card = (a: Prisma.ApplicationGetPayload<{ select: typeof select }>): BoardCard => {
    const t = timeline(a.announcement.applyStart, a.announcement.applyEnd, now);
    const p = progress.get(a.id);
    const ids = a.status === "review" && a.reviewerIds.length ? a.reviewerIds : a.ownerId ? [a.ownerId] : [];
    return {
      id: a.id,
      status: a.status,
      announcementId: a.announcement.id,
      title: a.announcement.title,
      organization: a.announcement.organization,
      score: a.match.score,
      t,
      dday: SUBMITTED.includes(a.status)
        ? `${md(a.submittedAt ?? a.statusChangedAt)} 제출`
        : t.phase === "upcoming" && a.announcement.applyStart
          ? `${md(a.announcement.applyStart)} 접수 시작`
          : ddayLabel(t),
      outcome: a.status === "submitted" ? "결과 대기" : a.status === "result_pass" ? "선정" : a.status === "result_fail" ? "미선정" : null,
      progress: p && p.total ? { done: p.done, total: p.total } : null,
      openComments: openByApp.get(a.id) ?? 0,
      people: ids.map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u),
    };
  };

  // 헤드라인: 진행 중이면서 14일 안에 마감인 공고
  const soon = inProgress
    .map((a) => a.announcement.applyEnd)
    .filter((d): d is Date => !!d && d.getTime() >= now.getTime() - 86_400_000 && d.getTime() <= now.getTime() + 14 * 86_400_000)
    .sort((x, y) => x.getTime() - y.getTime());

  return {
    columns: {
      recommended: recommended.map(card),
      drafting: drafting.map(card),
      review: review.map(card),
      submitted: submitted.map(card),
    } satisfies Record<BoardColumnKey, BoardCard[]>,
    recommendedMore: Math.max(0, recommendedTotal - recommended.length),
    headline: soon.length ? { until: soon[soon.length - 1], count: soon.length } : null,
    inProgress: inProgress.length,
    reviewWaiting: review.length,
    submittedThisMonth,
    // "1 / 4건": 이번 달 목표 = 이번 달 제출 + 진행 중이면서 이번 달 안에 마감
    dueThisMonth: submittedThisMonth + inProgress.filter((a) => a.announcement.applyEnd && sameKstMonth(a.announcement.applyEnd, now) && a.announcement.applyEnd >= now).length,
  };
}

const sameKstMonth = (a: Date, b: Date) => {
  const x = kstYmd(a);
  const y = kstYmd(b);
  return x.year === y.year && x.month === y.month;
};

const md = (d: Date) => {
  const { month, day } = kstYmd(d);
  return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
};

async function countSubmittedThisMonth(companyId: string, now: Date) {
  const { year, month } = kstYmd(now);
  const start = new Date(Date.UTC(year, month - 1, 1) - 9 * 3600_000); // KST 1일 0시
  return prisma.application.count({ where: { companyId, submittedAt: { gte: start }, status: { in: ["submitted", "result_pass", "result_fail"] } } });
}
