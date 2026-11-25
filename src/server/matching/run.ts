import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { llmConfigured } from "@/server/llm";
import { STATUS_STYLE } from "@/lib/status";
import { kstDayStart } from "@/lib/kst";
import { hardFilter } from "./hardFilter";
import { scoreAnnouncement, type ScoreContext } from "./score";
import type { Prisma } from "@/generated/prisma/client";


export type RefreshResult = { checked: number; created: number; excluded: number; restored: number; toScore: number };

/**
 * 하드필터를 다시 돌려 Match·Application을 맞춘다 (LLM 없음, 빠름).
 * - 새 공고: Match + Application(new 또는 자동 제외) 생성
 * - 사람이 정한 상태는 건드리지 않는다. 자동 제외만 조건이 바뀌면 new로 되돌린다
 * - 통과했고 점수가 없거나 공고 내용이 바뀌었으면 점수 대기(pending)
 */
export const NEWSLETTER_UNSCORED = ["뉴스", "투자", "기타"];

export async function refreshMatches(opts: { announcementIds?: string[]; now?: Date } = {}): Promise<RefreshResult> {
  const now = opts.now ?? new Date();
  const company = await getCompany();
  const rules = await prisma.exclusionRule.findMany({ where: { companyId: company.id }, select: { kind: true, value: true } });

  const announcements = await prisma.announcement.findMany({
    where: {
      duplicateOfId: null,
      // 접수 중인 것 + 아직 매칭이 없는 것(마감 공고도 행은 만들어 둔다 → 목록에서 "마감 공고도 보기")
      OR: [{ applyEnd: null }, { applyEnd: { gte: kstDayStart(now) } }, { matches: { none: { companyId: company.id } } }],
      ...(opts.announcementIds ? { id: { in: opts.announcementIds } } : {}),
    },
    select: {
      id: true, source: true, title: true, organization: true, summary: true, target: true, regionLimit: true,
      category: true, hashtags: true, applyEnd: true, contentHash: true,
      matches: { where: { companyId: company.id }, select: { id: true, hardFilterPassed: true, excludeReason: true, filterNotes: true, scoreStatus: true, scoredHash: true } },
      applications: { where: { companyId: company.id }, select: { id: true, status: true, autoExcluded: true } },
    },
  });

  const res: RefreshResult = { checked: announcements.length, created: 0, excluded: 0, restored: 0, toScore: 0 };
  const newMatches: Prisma.MatchCreateManyInput[] = [];
  const newApps: Prisma.ApplicationCreateManyInput[] = [];

  for (const a of announcements) {
    const f = hardFilter(a, company, rules, now);
    const match = a.matches[0];
    const app = a.applications[0];
    // 뉴스레터의 뉴스·투자 소식은 목록에만 보이고 점수는 매기지 않는다 (지원할 공고가 아님)
    const scorable = !(a.source === "newsletter" && a.category !== null && NEWSLETTER_UNSCORED.includes(a.category));
    const needsScore = f.passed && scorable && (!match || match.scoreStatus === "skipped" || (match.scoreStatus !== "pending" && match.scoreStatus !== "running" && match.scoredHash !== a.contentHash));

    if (!match) {
      newMatches.push({
        announcementId: a.id, companyId: company.id, hardFilterPassed: f.passed, excludeReason: f.excludeReason,
        filterNotes: f.notes, scoreStatus: f.passed && scorable ? "pending" : "skipped",
      });
    } else if (match.hardFilterPassed !== f.passed || match.excludeReason !== f.excludeReason || match.filterNotes.join("\n") !== f.notes.join("\n") || needsScore) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          hardFilterPassed: f.passed, excludeReason: f.excludeReason, filterNotes: f.notes,
          ...(f.passed && scorable ? (needsScore ? { scoreStatus: "pending", scoreError: null } : {}) : { scoreStatus: "skipped" }),
        },
      });
    }
    if (needsScore) res.toScore++;

    if (!app) {
      res.created++;
      if (!f.passed) res.excluded++;
      newApps.push({
        announcementId: a.id, companyId: company.id,
        status: f.passed ? "new" : "excluded", autoExcluded: !f.passed, excludedReason: f.passed ? null : f.excludeReason,
      });
    } else if (app.status === "new" && !f.passed) {
      res.excluded++;
      await setStatus(app.id, "new", "excluded", { reason: f.excludeReason, auto: true });
    } else if (app.status === "excluded" && app.autoExcluded && f.passed) {
      res.restored++;
      await setStatus(app.id, "excluded", "new", { reason: "규칙 검사를 다시 통과했어요", auto: true });
    } else if (app.status === "excluded" && app.autoExcluded && f.excludeReason) {
      await prisma.application.update({ where: { id: app.id }, data: { excludedReason: f.excludeReason } });
    }
  }

  if (newMatches.length) await prisma.match.createMany({ data: newMatches, skipDuplicates: true });
  if (newApps.length) await prisma.application.createMany({ data: newApps, skipDuplicates: true });
  return res;
}

/** 시스템이 바꾸는 상태 (하드필터). 사람의 변경은 actions에서 checkTransition 후 같은 함수를 쓴다 */
export async function setStatus(
  applicationId: string,
  from: keyof typeof STATUS_STYLE,
  to: keyof typeof STATUS_STYLE,
  opts: { reason?: string | null; auto?: boolean; userId?: string | null } = {},
) {
  const now = new Date();
  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId, status: from }, // 동시에 바뀌었으면 실패
      data: {
        status: to,
        statusChangedAt: now,
        autoExcluded: to === "excluded" ? !!opts.auto : false,
        excludedReason: to === "excluded" ? (opts.reason ?? null) : null,
        ...(to === "submitted" ? { submittedAt: now } : {}),
      },
    }),
    prisma.applicationEvent.create({ data: { applicationId, from, to, reason: opts.reason ?? null, userId: opts.userId ?? null } }),
  ]);
}

// ── LLM 점수 ─────────────────────────────────────────

export const DEFAULT_SCORE_LIMIT = () => Math.max(0, Number(process.env.SCORE_MAX_PER_RUN ?? 30) || 0);
const STALE_RUNNING_MS = 10 * 60_000;
const CONCURRENCY = 4;

let inFlight: Promise<ScoreRunResult> | null = null;
export type ScoreRunResult = { scored: number; failed: number; remaining: number; skipped?: "no-key" };

/** 점수 대기 중인 공고를 마감 가까운 순으로 limit개 매긴다. 같은 프로세스에서 겹쳐 돌지 않는다 */
export function scorePending(opts: { limit?: number; matchIds?: string[] } = {}): Promise<ScoreRunResult> {
  if (inFlight && !opts.matchIds) return inFlight;
  const p = runScoring(opts).finally(() => {
    if (inFlight === p) inFlight = null;
  });
  if (!opts.matchIds) inFlight = p;
  return p;
}

async function runScoring({ limit = DEFAULT_SCORE_LIMIT(), matchIds }: { limit?: number; matchIds?: string[] }): Promise<ScoreRunResult> {
  const company = await getCompany();
  const pendingWhere: Prisma.MatchWhereInput = { companyId: company.id, scoreStatus: "pending", hardFilterPassed: true };
  if (!llmConfigured()) return { scored: 0, failed: 0, remaining: await prisma.match.count({ where: pendingWhere }), skipped: "no-key" };

  // 죽은 실행이 잡고 있던 것 풀기
  await prisma.match.updateMany({
    where: { companyId: company.id, scoreStatus: "running", updatedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    data: { scoreStatus: "pending" },
  });

  const targets = await prisma.match.findMany({
    where: matchIds ? { id: { in: matchIds }, companyId: company.id, hardFilterPassed: true } : pendingWhere,
    orderBy: [{ announcement: { applyEnd: { sort: "asc", nulls: "last" } } }, { createdAt: "asc" }],
    take: matchIds ? undefined : limit,
    select: { id: true },
  });

  const now = new Date();
  const [cards, history] = await Promise.all([
    prisma.itemCard.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "asc" } }),
    prisma.application.findMany({
      where: { companyId: company.id, status: { in: ["submitted", "result_pass", "result_fail"] } },
      orderBy: { statusChangedAt: "desc" },
      take: 10,
      select: { status: true, resultNote: true, announcement: { select: { title: true } } },
    }),
  ]);
  const ctx: ScoreContext = {
    company,
    cards,
    history: history.map((h) => ({ title: h.announcement.title, status: STATUS_STYLE[h.status].label, resultNote: h.resultNote })),
    now,
  };

  let scored = 0;
  let failed = 0;
  const queue = targets.map((t) => t.id);
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      // 다른 프로세스(워커)와 겹치지 않게 선점
      const claimed = await prisma.match.updateMany({
        where: { id, scoreStatus: matchIds ? { in: ["pending", "scored", "failed"] } : "pending" },
        data: { scoreStatus: "running" },
      });
      if (claimed.count === 0) continue;
      const m = await prisma.match.findUniqueOrThrow({
        where: { id },
        select: { filterNotes: true, announcement: { select: { title: true, organization: true, executingOrg: true, target: true, regionLimit: true, applyPeriodText: true, supportAmountText: true, category: true, hashtags: true, summary: true, contentHash: true } } },
      });
      const r = await scoreAnnouncement(ctx, m.announcement, m.filterNotes);
      if (r.ok) {
        scored++;
        await prisma.match.update({
          where: { id },
          data: {
            scoreStatus: "scored", score: r.output.score, reasons: r.output.reasons, risks: r.output.risks,
            eligibility: r.output.eligibility, suggestedItemCardId: r.suggestedItemCardId,
            scoredHash: m.announcement.contentHash, model: r.model, promptVersion: r.promptVersion, scoredAt: new Date(), scoreError: null,
          },
        });
      } else {
        failed++;
        await prisma.match.update({ where: { id }, data: { scoreStatus: "failed", scoreError: r.error } });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  return { scored, failed, remaining: await prisma.match.count({ where: pendingWhere }) };
}
