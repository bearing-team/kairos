// 알림 메시지 만들기 (DB·네트워크 없음 → 테스트 가능). 형식은 ARCHITECTURE.md 7절
import { ddayLabel, timeline } from "@/lib/dday";
import { kstYmd } from "@/lib/kst";
import { STATUS_STYLE, type ApplicationStatus } from "@/lib/status";
import { link } from "./slack";

export type NotifyItem = {
  applicationId: string;
  announcementId: string;
  title: string;
  url: string | null; // 원문 공고
  applyStart: Date | null;
  applyEnd: Date | null;
  score: number | null;
  status: ApplicationStatus;
};

const md = (d: Date) => {
  const { month, day } = kstYmd(d);
  return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
};

/** 원문이 없으면 앱 상세로 */
const itemUrl = (it: NotifyItem, appBaseUrl: string | null) => it.url ?? (appBaseUrl ? `${appBaseUrl}/announcements/${it.announcementId}` : null);

/** "12.08 마감 (D-15)" / "12.19 마감 · 12.01 접수 시작" / "상시" */
export function deadlineText(it: Pick<NotifyItem, "applyStart" | "applyEnd">, now: Date) {
  const t = timeline(it.applyStart, it.applyEnd, now);
  if (!it.applyEnd) return t.phase === "upcoming" && it.applyStart ? `${md(it.applyStart)} 접수 시작` : "상시 접수";
  if (t.phase === "open") return `${md(it.applyEnd)} 마감 (${ddayLabel(t)})`;
  if (t.phase === "upcoming" && it.applyStart) return `${md(it.applyEnd)} 마감 · ${md(it.applyStart)} 접수 시작`;
  return `${md(it.applyEnd)} 마감`;
}

export function digestText(items: NotifyItem[], now: Date, appBaseUrl: string | null) {
  const lines = items.map((it) =>
    [`• ${link(itemUrl(it, appBaseUrl), it.title)} — ${deadlineText(it, now)}`, it.score !== null ? `적합 ${it.score}` : null, STATUS_STYLE[it.status].label]
      .filter(Boolean)
      .join(" · "),
  );
  const head = items.length ? `*이번 주에 챙길 공고 ${items.length}개*` : "*이번 주에 챙길 공고가 없어요*";
  const tail = appBaseUrl ? `전체 보기: ${link(appBaseUrl, appBaseUrl.replace(/^https?:\/\//, ""))}` : null;
  return [head, ...lines, tail].filter(Boolean).join("\n");
}

// ── 마감 알림 ─────────────────────────────────────────

export const DEADLINE_BUCKETS = [7, 3, 1] as const;

/** 남은 날이 들어가는 가장 좁은 구간 (D-5 → 7, D-2 → 3, D-0 → 1). 7일보다 멀면 null */
export function deadlineBucket(daysLeft: number): number | null {
  if (daysLeft < 0) return null;
  const fits = DEADLINE_BUCKETS.filter((b) => daysLeft <= b);
  return fits.length ? Math.min(...fits) : null;
}

export function deadlineAlertText(items: NotifyItem[], now: Date, appBaseUrl: string | null) {
  const lines = items.map((it) => {
    const t = timeline(it.applyStart, it.applyEnd, now);
    return `• ${link(itemUrl(it, appBaseUrl), it.title)} — *${ddayLabel(t)}* · ${STATUS_STYLE[it.status].label}${
      appBaseUrl ? ` · ${link(`${appBaseUrl}/announcements/${it.announcementId}`, "열기")}` : ""
    }`;
  });
  return [`*마감이 다가오는 공고 ${items.length}개*`, ...lines].join("\n");
}

/** 리뷰 요청 (F6.3): "<링크|공고명> 초안 리뷰를 부탁해요" + 리뷰어·마감·확인 필요 */
export function reviewRequestText(r: {
  title: string;
  draftUrl: string | null;
  requester: string;
  reviewers: string[];
  applyStart: Date | null;
  applyEnd: Date | null;
  sections: number;
  checks: number;
  note: string | null;
}, now: Date) {
  const lines = [
    `${r.requester}님이 초안 리뷰를 요청했어요`,
    `• ${link(r.draftUrl, r.title)} — ${deadlineText(r, now)}`,
    `리뷰어: ${r.reviewers.length ? r.reviewers.join(", ") : "아직 없음"} · 섹션 ${r.sections}개${r.checks ? ` · 확인 필요 ${r.checks}곳` : ""}`,
  ];
  if (r.note) lines.push(`메모: ${r.note.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}`);
  return lines.join("\n");
}
