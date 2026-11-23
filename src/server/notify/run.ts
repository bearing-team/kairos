// 알림 발송: 다이제스트·마감 알림. 스크립트·워커·서버 액션이 같이 쓴다 (server-only 없음)
import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { focusWhere, openAnnouncementWhere } from "@/server/matches";
import { kstDateString, kstDayStart } from "@/lib/kst";
import { timeline } from "@/lib/dday";
import type { Prisma } from "@/generated/prisma/client";
import { deadlineAlertText, deadlineBucket, digestText, type NotifyItem } from "./messages";
import { postSlack } from "./slack";

const DAY = 86_400_000;
const appBaseUrl = () => process.env.APP_BASE_URL?.trim().replace(/\/+$/, "") || null;

const itemSelect = {
  id: true,
  status: true,
  match: { select: { score: true } },
  announcement: { select: { id: true, title: true, url: true, applyStart: true, applyEnd: true } },
} satisfies Prisma.ApplicationSelect;

const toItem = (r: Prisma.ApplicationGetPayload<{ select: typeof itemSelect }>): NotifyItem => ({
  applicationId: r.id,
  announcementId: r.announcement.id,
  title: r.announcement.title,
  url: r.announcement.url,
  applyStart: r.announcement.applyStart,
  applyEnd: r.announcement.applyEnd,
  score: r.match.score,
  status: r.status,
});

export type SendOpts = { dryRun?: boolean; manual?: boolean; userId?: string | null; now?: Date };
export type SendResult =
  | { sent: true; text: string; itemCount: number }
  | { sent: false; text: string; itemCount: number; reason: "dry-run" | "already-sent" | "nothing" | "error"; error?: string };

// ── 주간 다이제스트 ───────────────────────────────────

export async function buildDigest(now = new Date()) {
  const company = await getCompany();
  const rows = await prisma.application.findMany({
    where: focusWhere(company.id, now),
    orderBy: [{ announcement: { applyEnd: { sort: "asc", nulls: "last" } } }, { match: { score: { sort: "desc", nulls: "last" } } }],
    take: 30,
    select: itemSelect,
  });
  const items = rows.map(toItem);
  return { items, text: digestText(items, now, appBaseUrl()) };
}

/** 일정 발송은 그 주(월요일 날짜)에 한 번만. 수동은 매번 보낸다 */
export async function sendDigest(opts: SendOpts = {}): Promise<SendResult> {
  const now = opts.now ?? new Date();
  const { items, text } = await buildDigest(now);
  if (opts.dryRun) return { sent: false, reason: "dry-run", text, itemCount: items.length };

  const kstWeekday = new Date(now.getTime() + 9 * 3600e3).getUTCDay(); // 0=일
  const monday = new Date(kstDayStart(now).getTime() - ((kstWeekday + 6) % 7) * DAY);
  const key = opts.manual ? null : `digest:${kstDateString(monday)}`;
  if (key && (await prisma.notification.findUnique({ where: { dedupeKey: key } }))) {
    return { sent: false, reason: "already-sent", text, itemCount: items.length };
  }
  return deliver("digest", text, items.length, key, opts);
}

// ── 마감 알림 ─────────────────────────────────────────

const ALERT_STATUSES = ["drafting", "review"] as const; // 진행 중 (PRD F6.2)

export async function buildDeadlineAlerts(now = new Date()) {
  const company = await getCompany();
  const rows = await prisma.application.findMany({
    where: {
      companyId: company.id,
      status: { in: [...ALERT_STATUSES] },
      announcement: { ...openAnnouncementWhere(now), applyEnd: { not: null, lt: new Date(kstDayStart(now).getTime() + 8 * DAY) } },
    },
    orderBy: { announcement: { applyEnd: "asc" } },
    select: { ...itemSelect, deadlineAlerts: { select: { bucket: true } } },
  });
  const due: { item: NotifyItem; bucket: number }[] = [];
  for (const r of rows) {
    const t = timeline(r.announcement.applyStart, r.announcement.applyEnd, now);
    if (t.phase !== "open" || t.daysLeft === null) continue;
    const bucket = deadlineBucket(t.daysLeft);
    if (bucket === null || r.deadlineAlerts.some((a) => a.bucket === bucket)) continue; // 그 구간은 이미 알림
    due.push({ item: toItem(r), bucket });
  }
  return { due, text: due.length ? deadlineAlertText(due.map((d) => d.item), now, appBaseUrl()) : "" };
}

export async function sendDeadlineAlerts(opts: SendOpts = {}): Promise<SendResult> {
  const now = opts.now ?? new Date();
  const { due, text } = await buildDeadlineAlerts(now);
  if (!due.length) return { sent: false, reason: "nothing", text, itemCount: 0 };
  if (opts.dryRun) return { sent: false, reason: "dry-run", text, itemCount: due.length };
  return deliver("deadline", text, due.length, null, opts, due);
}

// ── 공통 ─────────────────────────────────────────────

async function deliver(
  kind: "digest" | "deadline",
  text: string,
  itemCount: number,
  dedupeKey: string | null,
  opts: SendOpts,
  alerts: { item: NotifyItem; bucket: number }[] = [],
): Promise<SendResult> {
  const r = await postSlack(text);
  // 성공했을 때만 중복 방지 키·마감 구간을 기록 → 실패하면 다음 실행에서 다시 보낸다
  await prisma.notification.create({
    data: {
      kind, text, itemCount, ok: r.ok, error: r.ok ? null : r.error, manual: !!opts.manual, userId: opts.userId ?? null,
      dedupeKey: r.ok ? dedupeKey : null,
      alerts: r.ok ? { create: alerts.map((a) => ({ applicationId: a.item.applicationId, bucket: a.bucket })) } : undefined,
    },
  });
  return r.ok ? { sent: true, text, itemCount } : { sent: false, reason: "error", error: r.error, text, itemCount };
}

export async function recentNotifications(take = 10) {
  return prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, kind: true, itemCount: true, ok: true, error: true, manual: true, createdAt: true } });
}

export function describeSend(r: SendResult) {
  if (r.sent) return `보냈어요 (${r.itemCount}건)`;
  return { "dry-run": `미리보기 (${r.itemCount}건)`, "already-sent": "이번 주에는 이미 보냈어요", nothing: "보낼 공고가 없어요", error: `실패: ${r.error}` }[r.reason];
}
