// 소스의 날짜 문자열 → KST 자정 기준 Date (저장은 UTC)

/** "20220727", "2022-07-27", "2022.07.27" → 그날 KST 00:00 */
export function parseKstDate(input: unknown): Date | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const m = String(input).trim().match(/^(\d{4})[-.\/]?(\d{1,2})[-.\/]?(\d{1,2})/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d) - 9 * 3600 * 1000);
  // 2월 30일 같은 값 거르기
  const back = new Date(date.getTime() + 9 * 3600 * 1000);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return date;
}

/** "20220727 ~ 20220930" → { start, end }. 날짜가 아니면(상시 등) 둘 다 null */
export function parseKstRange(input: unknown): { start: Date | null; end: Date | null } {
  if (typeof input !== "string") return { start: null, end: null };
  const parts = input.split(/~|∼|〜/).map((s) => s.trim());
  if (parts.length !== 2) return { start: null, end: null };
  return { start: parseKstDate(parts[0]), end: parseKstDate(parts[1]) };
}
