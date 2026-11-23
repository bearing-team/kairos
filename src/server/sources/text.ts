const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };

/** HTML 태그·엔티티를 걷어내고 공백을 정리한 텍스트. 빈 문자열이면 null */
export function cleanText(input: unknown): string | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const s = String(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s ? s : null;
}

/** 소스 간 중복 판별용 제목 정규화: 괄호 머리말·공백·기호 제거, 소문자 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^\s*(\[[^\]]*\]|\([^)]*\)|【[^】]*】)\s*/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function splitList(input: unknown): string[] {
  if (typeof input !== "string") return [];
  return [...new Set(input.split(/[,，]/).map((s) => s.trim()).filter(Boolean))];
}
