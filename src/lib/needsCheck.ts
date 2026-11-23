// 【확인 필요: …】 표시 찾기 (서버·화면 공통, 순수 함수)
const RE = /【\s*확인\s*필요\s*[:：]?\s*([^】]*)】/g;

export function extractChecks(content: string): string[] {
  return [...content.matchAll(RE)].map((m) => m[1].trim() || "확인 필요");
}

/** 본문을 일반 글자 / 확인 필요 조각으로 나눈다 (하이라이트용) */
export function splitChecks(content: string): { text: string; check: boolean }[] {
  const out: { text: string; check: boolean }[] = [];
  let last = 0;
  for (const m of content.matchAll(RE)) {
    if (m.index > last) out.push({ text: content.slice(last, m.index), check: false });
    out.push({ text: m[0], check: true });
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push({ text: content.slice(last), check: false });
  return out;
}

/** 모델이 준 목록 + 본문에서 찾은 것 (중복 제거, 본문 순서 우선) */
export function mergeChecks(content: string, fromModel: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...extractChecks(content), ...fromModel.map((s) => s.trim()).filter(Boolean)]) {
    const k = c.replace(/\s+/g, "");
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
}

/** 공백 포함 글자 수 (분량 제한 기준) */
export const charCount = (s: string) => [...s.replace(/\r/g, "")].length;
