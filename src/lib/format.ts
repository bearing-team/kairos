import { kstYmd } from "./kst";

/** "오늘 오전 9시", "어제 오후 3시 20분", "11월 20일 오전 8시" */
export function formatKstRelative(date: Date, now: Date): string {
  const d = kstYmd(date);
  const n = kstYmd(now);
  const dayDiff = Math.round((Date.UTC(n.year, n.month - 1, n.day) - Date.UTC(d.year, d.month - 1, d.day)) / 86_400_000);
  const time = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "numeric" })
    .format(date)
    .replace(/ 0분$/, "")
    .replace(/:00$/, "");
  const prefix = dayDiff === 0 ? "오늘" : dayDiff === 1 ? "어제" : `${d.month}월 ${d.day}일`;
  return `${prefix} ${time}`;
}
