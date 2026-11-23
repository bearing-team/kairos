// 접수 기간 → D-day / 진행률. 모든 날짜는 KST 달력 날짜로 비교 (DESIGN.md TimelineBar)
import { kstYmd } from "./kst";

const DAY = 86_400_000;
const dayNumber = (d: Date) => {
  const { year, month, day } = kstYmd(d);
  return Math.round(Date.UTC(year, month - 1, day) / DAY);
};

export type Timeline =
  | { phase: "unknown" } // 날짜 없음 (상시 등)
  | { phase: "closed"; daysAgo: number }
  | { phase: "upcoming"; daysToStart: number }
  | { phase: "open"; daysLeft: number | null; progress: number; urgent: boolean };

export const URGENT_DAYS = 7;

export function timeline(applyStart: Date | null, applyEnd: Date | null, now: Date): Timeline {
  const today = dayNumber(now);
  const start = applyStart ? dayNumber(applyStart) : null;
  const end = applyEnd ? dayNumber(applyEnd) : null;
  if (start === null && end === null) return { phase: "unknown" };
  if (end !== null && today > end) return { phase: "closed", daysAgo: today - end };
  if (start !== null && today < start) return { phase: "upcoming", daysToStart: start - today };
  if (end === null) return { phase: "open", daysLeft: null, progress: 0.5, urgent: false };
  const daysLeft = end - today;
  const progress = start === null || end === start ? 1 : Math.min(1, Math.max(0, (today - start) / (end - start)));
  return { phase: "open", daysLeft, progress, urgent: daysLeft <= URGENT_DAYS };
}

/** 오른쪽 D-day 라벨 */
export function ddayLabel(t: Timeline): string {
  switch (t.phase) {
    case "unknown":
      return "상시";
    case "closed":
      return "마감";
    case "upcoming":
      return `시작 D-${t.daysToStart}`;
    case "open":
      return t.daysLeft === null ? "접수 중" : t.daysLeft === 0 ? "오늘 마감" : `D-${t.daysLeft}`;
  }
}

/** "11.20 – 12.08" */
export function periodLabel(applyStart: Date | null, applyEnd: Date | null): string | null {
  const f = (d: Date) => {
    const { month, day } = kstYmd(d);
    return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  };
  if (!applyStart && !applyEnd) return null;
  return `${applyStart ? f(applyStart) : ""} – ${applyEnd ? f(applyEnd) : ""}`.trim();
}
