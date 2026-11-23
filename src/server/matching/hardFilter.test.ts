import { describe, expect, it } from "vitest";
import { ageSatisfies, hardFilter, parseAgeRules, type FilterAnnouncement } from "./hardFilter";
import { normalizeRegion, parseRegionList, regionFromOrg, regionFromTitle } from "@/lib/region";

const kst = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const NOW = kst("2026-11-23");
const company = { foundedAt: kst("2026-03-02"), region: "부산" }; // 업력 1년 미만
const base: FilterAnnouncement = {
  title: "2027년 초기창업패키지",
  organization: "중소벤처기업부",
  summary: null,
  target: null,
  regionLimit: null,
  category: null,
  hashtags: [],
  applyEnd: kst("2026-12-08"),
};

describe("지역 정규화", () => {
  it("긴 이름·짧은 이름·목록", () => {
    expect(normalizeRegion("부산광역시")).toBe("부산");
    expect(normalizeRegion("경상남도")).toBe("경남");
    expect(normalizeRegion("전북특별자치도")).toBe("전북");
    expect(normalizeRegion("전국")).toBeNull();
    expect(parseRegionList("서울, 경기")).toEqual(["서울", "경기"]);
  });
  it("공고명 꼬리표, 기관명", () => {
    expect(regionFromTitle("[경기] 2026년 스타트업 지원")).toBe("경기");
    expect(regionFromTitle("(부산광역시) 모집")).toBe("부산");
    expect(regionFromTitle("[공고] 모집")).toBeNull();
    expect(regionFromOrg("부산광역시 해운대구")).toBe("부산");
    expect(regionFromOrg("경기도경제과학진흥원")).toBeNull(); // 확실한 지자체명만
    expect(regionFromOrg("중소벤처기업부")).toBeNull();
  });
});

describe("업력 요건 파싱", () => {
  it("이내·미만·이상·범위", () => {
    expect(parseAgeRules("창업 3년 이내 기업")).toMatchObject([{ max: 3 }]);
    expect(parseAgeRules("업력 3년 미만")).toMatchObject([{ max: 3, maxExclusive: true }]);
    expect(parseAgeRules("업력 3~7년 기업")).toMatchObject([{ min: 3, max: 7 }]);
    expect(parseAgeRules("업력 3년 초과 7년 이내")).toMatchObject([{ min: 3, minExclusive: true, max: 7 }]);
    expect(parseAgeRules("설립 후 5년 이상")).toMatchObject([{ min: 5 }]);
  });
  it("우대 문맥은 요건이 아니다", () => {
    expect(parseAgeRules("창업 3년 이상 기업 우대")).toEqual([]);
    expect(parseAgeRules("업력 7년 이내 가점")).toEqual([]);
  });
  it("범위 판정", () => {
    expect(ageSatisfies(0.7, { max: 3, text: "" })).toBe(true);
    expect(ageSatisfies(0.7, { min: 3, max: 7, text: "" })).toBe(false);
    expect(ageSatisfies(3, { max: 3, maxExclusive: true, text: "" })).toBe(false);
  });
});

describe("hardFilter", () => {
  it("요건 없는 공고는 통과", () => {
    expect(hardFilter(base, company, [], NOW)).toEqual({ passed: true, excludeReason: null, notes: [] });
  });
  it("업력 미달은 제외, 사유 문장", () => {
    const r = hardFilter({ ...base, title: "창업도약패키지", target: "업력 3~7년 기업" }, company, [], NOW);
    expect(r.passed).toBe(false);
    expect(r.excludeReason).toBe("업력 3~7년 요건 미달로 제외됐어요");
  });
  it("여러 트랙 중 하나라도 맞으면 통과", () => {
    const r = hardFilter({ ...base, summary: "초기트랙: 창업 3년 이내, 도약트랙: 업력 3~7년" }, company, [], NOW);
    expect(r.passed).toBe(true);
  });
  it("설립일 없으면 통과 + 메모", () => {
    const r = hardFilter({ ...base, target: "창업 3년 이내" }, { ...company, foundedAt: null }, [], NOW);
    expect(r.passed).toBe(true);
    expect(r.notes[0]).toContain("설립일이 없어");
  });
  it("다른 지역 공고는 제외 (지역 필드·공고명·기관명)", () => {
    expect(hardFilter({ ...base, regionLimit: "서울" }, company, [], NOW).excludeReason).toBe("서울 지역 공고라 제외됐어요");
    expect(hardFilter({ ...base, title: "[경기] 창업 지원" }, company, [], NOW).excludeReason).toBe("경기 지역 공고라 제외됐어요 (공고명 기준)");
    expect(hardFilter({ ...base, organization: "경상남도" }, company, [], NOW).passed).toBe(false);
    expect(hardFilter({ ...base, regionLimit: "부산, 울산" }, company, [], NOW).passed).toBe(true);
  });
  it("개인 대상 전용은 제외", () => {
    expect(hardFilter({ ...base, target: "예비창업자" }, company, [], NOW).passed).toBe(false);
    expect(hardFilter({ ...base, target: "일반인, 대학생" }, company, [], NOW).passed).toBe(false);
    expect(hardFilter({ ...base, target: "예비창업자, 창업기업" }, company, [], NOW).passed).toBe(true);
    expect(hardFilter({ ...base, title: "2027년 예비창업패키지" }, company, [], NOW).passed).toBe(false);
  });
  it("마감 지난 공고는 제외 (마감일 당일은 통과)", () => {
    expect(hardFilter({ ...base, applyEnd: kst("2026-11-22") }, company, [], NOW).passed).toBe(false);
    expect(hardFilter({ ...base, applyEnd: kst("2026-11-23") }, company, [], NOW).passed).toBe(true);
  });
  it("제외 규칙", () => {
    const a = { ...base, title: "스마트 제조혁신 지원", hashtags: ["농식품"], regionLimit: "부산" };
    expect(hardFilter(a, company, [{ kind: "keyword", value: "제조" }], NOW).excludeReason).toBe("제외 규칙: '제조' 포함");
    expect(hardFilter(a, company, [{ kind: "industry", value: "농식품" }], NOW).passed).toBe(false);
    expect(hardFilter(a, company, [{ kind: "region", value: "부산광역시" }], NOW).passed).toBe(false);
    expect(hardFilter(a, company, [{ kind: "target", value: "소상공인" }], NOW).passed).toBe(true);
  });
});
