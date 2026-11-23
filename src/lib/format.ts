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

/** 받침에 맞는 "로/으로": 받침 없음·ㄹ받침 → "로", 그 외 → "으로". 한글이 아니면 "(으)로" */
export function withRo(word: string): string {
  const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}(으)로`;
  const jong = code % 28;
  return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`;
}
