// 1단계 하드필터 (규칙만, LLM 없이). ARCHITECTURE.md 5.1
// 원칙: 확실할 때만 제외한다. 애매하면 통과시키고 notes에 남겨 LLM·사람이 보게 한다
import { kstYmd } from "@/lib/kst";
import { normalizeRegion, parseRegionList, regionFromOrg, regionFromTitle, type Region } from "@/lib/region";
import type { ExclusionKind } from "@/generated/prisma/enums";

export type FilterCompany = { foundedAt: Date | null; region: string | null };
export type FilterRule = { kind: ExclusionKind; value: string };
export type FilterAnnouncement = {
  title: string;
  organization: string | null;
  summary: string | null;
  target: string | null;
  regionLimit: string | null;
  category: string | null;
  hashtags: string[];
  applyEnd: Date | null;
};
export type FilterResult = { passed: boolean; excludeReason: string | null; notes: string[] };

const DAY = 86_400_000;
const dayNumber = (d: Date) => {
  const { year, month, day } = kstYmd(d);
  return Math.round(Date.UTC(year, month - 1, day) / DAY);
};

// ── 업력 ─────────────────────────────────────────────

export type AgeRule = { min?: number; minExclusive?: boolean; max?: number; maxExclusive?: boolean; text: string };

const KW = String.raw`(?:업력|창업|설립|개업)\s*(?:후|이후|일로부터|기간)?\s*`;
const N = String.raw`(\d{1,2})\s*년`;
const RE_RANGE = new RegExp(String.raw`${KW}(\d{1,2})\s*년?\s*[~∼\-–]\s*${N}`, "g");
const RE_BOTH = new RegExp(String.raw`${KW}${N}\s*(이상|초과)\s*${N}\s*(이내|미만|이하)`, "g");
const RE_ONE = new RegExp(String.raw`${KW}${N}\s*(이내|미만|이하|이상|초과)`, "g");

/** 공고 텍스트에서 업력 요건 추출. "우대·가점" 문맥은 요건이 아니므로 뺀다 */
export function parseAgeRules(text: string): AgeRule[] {
  const rules: AgeRule[] = [];
  const taken: [number, number][] = [];
  const isPreference = (end: number) => /^\s*(?:\S{0,6}\s*)?(?:기업\s*)?(?:우대|가점)/.test(text.slice(end, end + 14));
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  const push = (m: RegExpExecArray, r: Omit<AgeRule, "text">) => {
    const s = m.index;
    const e = s + m[0].length;
    if (overlaps(s, e) || isPreference(e)) return;
    taken.push([s, e]);
    rules.push({ ...r, text: m[0].replace(/\s+/g, " ").trim() });
  };
  for (const m of text.matchAll(RE_BOTH)) push(m, { min: +m[1], minExclusive: m[2] === "초과", max: +m[3], maxExclusive: m[4] === "미만" });
  for (const m of text.matchAll(RE_RANGE)) push(m, { min: +m[1], max: +m[2] });
  for (const m of text.matchAll(RE_ONE)) {
    const n = +m[1];
    const op = m[2];
    push(m, op === "이상" || op === "초과" ? { min: n, minExclusive: op === "초과" } : { max: n, maxExclusive: op === "미만" });
  }
  return rules;
}

export function ageSatisfies(ageYears: number, r: AgeRule): boolean {
  if (r.min !== undefined && (r.minExclusive ? ageYears <= r.min : ageYears < r.min)) return false;
  if (r.max !== undefined && (r.maxExclusive ? ageYears >= r.max : ageYears > r.max)) return false;
  return true;
}

// ── 대상 ─────────────────────────────────────────────

const INDIVIDUAL_ONLY = new Set(["예비창업자", "일반인", "대학생", "대학원생", "청소년", "학생", "개인", "재학생", "졸업생"]);

/** 대상 목록이 전부 개인(예비창업자 등)이면 사유 문장 */
function individualOnlyReason(a: FilterAnnouncement): string | null {
  if (/예비창업패키지/.test(a.title)) return "예비창업자 전용 사업이라 제외됐어요";
  const tokens = (a.target ?? "")
    .split(/[,·/|]|\s+및\s+/)
    .map((t) => t.replace(/[()\s]/g, ""))
    .filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => INDIVIDUAL_ONLY.has(t))) return `${tokens.join("·")} 대상 공고라 제외됐어요`;
  return null;
}

// ── 지역 ─────────────────────────────────────────────

export function announcementRegions(a: Pick<FilterAnnouncement, "regionLimit" | "title" | "organization">): { regions: Region[]; inferredFrom: string | null } {
  const listed = parseRegionList(a.regionLimit);
  if (listed.length) return { regions: listed, inferredFrom: null };
  const t = regionFromTitle(a.title);
  if (t) return { regions: [t], inferredFrom: "공고명" };
  const o = regionFromOrg(a.organization);
  if (o) return { regions: [o], inferredFrom: "주관 기관" };
  return { regions: [], inferredFrom: null };
}

// ── 본체 ─────────────────────────────────────────────

const has = (hay: (string | null | undefined)[], needle: string) => {
  const n = needle.trim().toLowerCase();
  return !!n && hay.some((h) => h?.toLowerCase().includes(n));
};

export function hardFilter(a: FilterAnnouncement, company: FilterCompany, rules: FilterRule[], now: Date): FilterResult {
  const excludes: string[] = [];
  const notes: string[] = [];

  // 마감
  if (a.applyEnd && dayNumber(now) > dayNumber(a.applyEnd)) excludes.push("접수가 마감됐어요");

  // 업력: 여러 트랙(예: 초기 3년 이내 / 도약 3~7년)이 있으면 하나라도 맞으면 통과
  const ageRules = parseAgeRules([a.title, a.target, a.summary].filter(Boolean).join("\n"));
  if (ageRules.length) {
    if (!company.foundedAt) {
      notes.push(`설립일이 없어 업력 요건(${ageRules.map((r) => r.text).join(", ")})을 확인하지 못했어요`);
    } else {
      const age = (dayNumber(now) - dayNumber(company.foundedAt)) / 365.25;
      if (!ageRules.some((r) => ageSatisfies(age, r))) excludes.push(`${ageRules[0].text} 요건 미달로 제외됐어요`);
    }
  }

  // 지역
  const { regions, inferredFrom } = announcementRegions(a);
  if (regions.length) {
    const mine = normalizeRegion(company.region);
    if (!mine) notes.push(`소재지가 없어 지역 요건(${regions.join("·")})을 확인하지 못했어요`);
    else if (!regions.includes(mine)) excludes.push(`${regions.join("·")} 지역 공고라 제외됐어요${inferredFrom ? ` (${inferredFrom} 기준)` : ""}`);
  }

  // 대상
  const indiv = individualOnlyReason(a);
  if (indiv) excludes.push(indiv);

  // 제외 규칙
  for (const r of rules) {
    const v = r.value.trim();
    if (!v) continue;
    if (r.kind === "keyword" && has([a.title, a.summary], v)) excludes.push(`제외 규칙: '${v}' 포함`);
    if (r.kind === "target" && has([a.target, a.title], v)) excludes.push(`제외 규칙: 대상 '${v}'`);
    if (r.kind === "industry" && has([a.title, a.category, a.summary, ...a.hashtags], v)) excludes.push(`제외 규칙: 업종 '${v}'`);
    if (r.kind === "region") {
      const rr = normalizeRegion(v);
      if (rr && regions.includes(rr)) excludes.push(`제외 규칙: ${rr} 한정 공고`);
    }
  }

  return { passed: excludes.length === 0, excludeReason: excludes[0] ?? null, notes };
}
