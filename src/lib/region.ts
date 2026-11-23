import { REGIONS } from "./company";

export type Region = (typeof REGIONS)[number];

// 긴 이름 → 짧은 이름. 긴 이름을 먼저 검사해야 "경상남도"가 "경남"보다 먼저 잡힌다
const LONG: [string, Region][] = [
  ["서울특별시", "서울"], ["부산광역시", "부산"], ["대구광역시", "대구"], ["인천광역시", "인천"],
  ["광주광역시", "광주"], ["대전광역시", "대전"], ["울산광역시", "울산"], ["세종특별자치시", "세종"],
  ["경기도", "경기"], ["강원특별자치도", "강원"], ["강원도", "강원"], ["충청북도", "충북"], ["충청남도", "충남"],
  ["전북특별자치도", "전북"], ["전라북도", "전북"], ["전라남도", "전남"], ["경상북도", "경북"], ["경상남도", "경남"],
  ["제주특별자치도", "제주"], ["제주도", "제주"],
];

/** "부산광역시", "부산" → "부산". 모르는 값은 null */
export function normalizeRegion(s: string | null | undefined): Region | null {
  const v = s?.trim().replace(/\s+/g, "");
  if (!v) return null;
  for (const [long, short] of LONG) if (v.startsWith(long)) return short;
  for (const r of REGIONS) if (v === r || v.startsWith(r + "시") || v === r + "권") return r;
  return null;
}

/** 쉼표·가운뎃점으로 나열된 지역 목록 → 짧은 이름들 (전국이면 빈 배열) */
export function parseRegionList(s: string | null | undefined): Region[] {
  if (!s) return [];
  const out = new Set<Region>();
  for (const part of s.split(/[,·/|]|\s+및\s+/)) {
    const r = normalizeRegion(part);
    if (r) out.add(r);
  }
  return [...out];
}

/** 기관명이 광역 지자체 이름으로 시작하면 그 지역 (예: "경기도 경제과학진흥원" X, "경기도" O, "부산광역시 해운대구" O) */
export function regionFromOrg(org: string | null | undefined): Region | null {
  const v = org?.trim();
  if (!v) return null;
  for (const [long, short] of LONG) if (v === long || v.startsWith(long + " ")) return short;
  return null;
}

/** 공고명 앞 "[부산]", "(부산광역시)" 꼬리표 */
export function regionFromTitle(title: string): Region | null {
  const m = title.trim().match(/^[[(【]\s*([^\])】]{2,12})\s*[\])】]/);
  return m ? normalizeRegion(m[1]) : null;
}
