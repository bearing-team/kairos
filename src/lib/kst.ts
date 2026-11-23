// 날짜는 전부 Asia/Seoul 기준으로 계산한다 (저장은 UTC). ARCHITECTURE.md 11절
const TZ = "Asia/Seoul";

type YMD = { year: number; month: number; day: number };

/** 주어진 시각의 KST 연·월·일 */
export function kstYmd(date: Date): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** "11월 23일 월요일" */
export function formatKstHeaderDate(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

/** 만 업력(년). 설립일과 오늘 모두 KST 날짜로 비교 */
export function yearsInBusiness(foundedAt: Date, now: Date): number {
  const f = kstYmd(foundedAt);
  const t = kstYmd(now);
  let years = t.year - f.year;
  if (t.month < f.month || (t.month === f.month && t.day < f.day)) years -= 1;
  return Math.max(0, years);
}

/** 사이드바 표기: "업력 1년 미만", "업력 2년" */
export function formatYearsInBusiness(foundedAt: Date, now: Date): string {
  const y = yearsInBusiness(foundedAt, now);
  return y < 1 ? "업력 1년 미만" : `업력 ${y}년`;
}

/** "2026-11-23" (KST 달력 날짜) */
export function kstDateString(date: Date): string {
  const { year, month, day } = kstYmd(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 그 시각이 속한 KST 날짜의 00:00 (UTC Date). applyEnd(마감일 KST 자정)가 이보다 작으면 마감 */
export function kstDayStart(date: Date): Date {
  const { year, month, day } = kstYmd(date);
  return new Date(Date.UTC(year, month - 1, day) - 9 * 3600e3);
}
