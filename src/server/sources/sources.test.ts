import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBizinfoResponse, extractBizinfoItems } from "./bizinfo";
import { parseKstartupResponse, extractKstartupPage } from "./kstartup";
import { parseKstDate, parseKstRange } from "./dates";
import { cleanText, normalizeTitle } from "./text";
import { contentHash, dedupeKey } from "./dedupe";

const fx = (p: string) => JSON.parse(readFileSync(path.join(__dirname, "../../../fixtures", p), "utf8"));
const kstDay = (d: Date | null) => (d ? new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10) : null);

describe("dates", () => {
  it("yyyyMMdd는 KST 자정", () => {
    expect(parseKstDate("20261208")?.toISOString()).toBe("2026-12-07T15:00:00.000Z");
    expect(parseKstDate("2026-12-08")?.toISOString()).toBe("2026-12-07T15:00:00.000Z");
    expect(parseKstDate("20260230")).toBeNull();
    expect(parseKstDate("상시")).toBeNull();
  });
  it("기간 문자열", () => {
    const r = parseKstRange("20220727 ~ 20220930");
    expect(kstDay(r.start)).toBe("2022-07-27");
    expect(kstDay(r.end)).toBe("2022-09-30");
    expect(parseKstRange("예산 소진시까지")).toEqual({ start: null, end: null });
  });
});

describe("text", () => {
  it("HTML·엔티티 제거", () => {
    expect(cleanText("<p>A&#39;B&nbsp;&amp; C</p>D<br/>E")).toBe("A'B & C\nD\nE");
    expect(cleanText("  ")).toBeNull();
  });
  it("제목 정규화는 머리말·공백·기호를 무시", () => {
    expect(normalizeTitle("[부산] 2027년 SW 기업 성장지원 사업")).toBe(normalizeTitle("2027년 SW기업 성장지원사업"));
  });
});

describe("bizinfo", () => {
  const items = parseBizinfoResponse(fx("bizinfo/spec-sample.json"));

  it("ID 없는 항목을 버리고 정규화한다", () => {
    expect(items).toHaveLength(2);
    const a = items[0];
    expect(a.externalId).toBe("PBLN_000000000080236");
    expect(a.organization).toBe("중소벤처기업부");
    expect(a.executingOrg).toBe("지방중소벤처기업청");
    expect(a.summary).toContain("'착한임대인'");
    expect(a.summary).not.toContain("<p>");
    expect(kstDay(a.applyStart)).toBe("2022-07-27");
    expect(kstDay(a.applyEnd)).toBe("2022-09-30");
    expect(a.hashtags).toEqual(["2022", "금융", "충북", "대전", "중소벤처기업부"]);
    expect(a.attachments.map((x) => x.kind)).toEqual(["notice", "other"]);
  });

  it("날짜가 아닌 신청기간은 원문만 남긴다", () => {
    expect(items[1].applyEnd).toBeNull();
    expect(items[1].applyPeriodText).toBe("예산 소진시까지");
  });

  it("객체로 감싼 응답에서도 배열을 찾는다", () => {
    expect(extractBizinfoItems({ anyKey: fx("bizinfo/spec-sample.json") })).toHaveLength(3);
    expect(() => extractBizinfoItems({ foo: 1 })).toThrow();
  });
});

describe("kstartup", () => {
  const items = parseKstartupResponse(fx("kstartup/spec-sample.json"));

  it("정규화한다", () => {
    expect(items).toHaveLength(2);
    const [a, b] = items;
    expect(a.externalId).toBe("175000");
    expect(a.organization).toBe("중소벤처기업부");
    expect(a.executingOrg).toBe("창업진흥원");
    expect(a.regionLimit).toBeNull(); // 전국
    expect(kstDay(a.applyEnd)).toBe("2026-12-08");
    expect(a.url).toBe("https://www.k-startup.go.kr/sample/175000");
    expect(a.applyUrl).toBe("https://www.k-startup.go.kr/sample/apply/175000");
    expect(b.regionLimit).toBe("부산");
    expect(b.executingOrg).toBeNull(); // 주관=수행
  });

  it("data가 한 번 더 감싸인 형태도 받는다", () => {
    const body = fx("kstartup/spec-sample.json");
    expect(extractKstartupPage({ ...body, data: { data: body.data } }).items).toHaveLength(2);
  });
});

describe("dedupe", () => {
  it("같은 공고는 소스가 달라도 같은 키", () => {
    const end = parseKstDate("20261128");
    expect(dedupeKey({ title: "[부산] 부산 SW기업 성장지원사업", organization: "부산정보산업진흥원", applyEnd: end })).toBe(
      dedupeKey({ title: "부산 SW 기업 성장지원 사업", organization: "부산정보산업 진흥원", applyEnd: end }),
    );
  });
  it("raw만 바뀌면 해시가 같다", () => {
    const [a] = parseKstartupResponse(fx("kstartup/spec-sample.json"));
    expect(contentHash({ ...a, raw: { x: 1 } })).toBe(contentHash(a));
    expect(contentHash({ ...a, title: "변경" })).not.toBe(contentHash(a));
  });
});

// 실제 응답 fixture(live-*.json)가 있으면 최소한 파싱이 되는지 확인
describe("live fixtures", () => {
  it.todo("실제 응답 fixture 추가 (pnpm sync:probe)");
  for (const [dir, parse] of [
    ["bizinfo", parseBizinfoResponse],
    ["kstartup", parseKstartupResponse],
  ] as const) {
    const files = readdirSync(path.join(__dirname, "../../../fixtures", dir)).filter((f) => f.startsWith("live-"));
    for (const f of files) {
      it(`${dir}/${f} 파싱`, () => {
        const items = parse(fx(`${dir}/${f}`));
        expect(items.length).toBeGreaterThan(0);
        for (const it of items) expect(it.title && it.externalId).toBeTruthy();
      });
    }
  }
});
