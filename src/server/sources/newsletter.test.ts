import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseNewsletter, sectionKind, type PdfLine, type PdfLink } from "./newsletterPdf";
import { readFeatpaperPage } from "./featpaper";
import { apiRef, rowToAnnouncement } from "./newsletter";

const fx = (f: string) => readFileSync(`fixtures/newsletters/${f}`, "utf8");
const lines = JSON.parse(fx("sensible-weekly-20261116-lines.json")) as PdfLine[];
const links = JSON.parse(fx("featpaper-annotations-20261116.json")).data.annotations as Record<string, PdfLink[]>;
const items = parseNewsletter(lines, links);

describe("뉴스레터 PDF 표 읽기 (센서블박스 위클리)", () => {
  it("구역별 줄 수", () => {
    const by = (k: string) => items.filter((i) => i.kind === k).length;
    expect(by("grant")).toBe(40);
    expect(by("event")).toBe(23);
    expect(by("news")).toBe(8);
    expect(by("investment")).toBe(24);
  });

  it("지원사업은 전부 마감일과 링크가 있다", () => {
    const grants = items.filter((i) => i.kind === "grant");
    expect(grants.every((g) => /^\d{4}-\d{2}-\d{2}$/.test(g.date ?? "") && g.href?.startsWith("http"))).toBe(true);
  });

  it("여러 줄 셀을 한 항목으로 묶는다 (행사 장소가 두 줄)", () => {
    const yonsei = items.find((i) => i.text.includes("연세미래"));
    expect(yonsei?.date).toBe("2026-11-18");
    expect(yonsei?.time).toBe("14:00");
    expect(yonsei?.text).toContain("컨버전스홀");
    expect(items.some((i) => i.title === "컨버전스홀" || i.title === "서울연세대학교미래캠퍼스")).toBe(false);
  });

  it("기간 행사는 끝날까지", () => {
    const jeju = items.find((i) => i.text.includes("제주권역"));
    expect(jeju?.endDate).toBe("2026-11-19");
  });

  it("링크가 'undefined'면 없는 것으로", () => {
    expect(items.some((i) => i.href === "undefined")).toBe(false);
  });

  it("구역 이름 → 분류", () => {
    expect(sectionKind("지원사업①")).toBe("grant");
    expect(sectionKind("행사·데모데이")).toBe("event");
    expect(sectionKind("투자 유치")).toBe("investment");
  });
});

describe("피트페이퍼 공유 페이지", () => {
  it("문서 코드·제목·PDF uuid", () => {
    const m = readFeatpaperPage(fx("featpaper-share-20261116.html"), "https://featpaper.com/u/x/y");
    expect(m.key).toBe("CGhhkscp");
    expect(m.title).toBe("센서블박스 위클리 2026년 11월 3주차");
    expect(m.uuid).toBe("de93c822-6dbc-4396-a79d-b7a8efa1cdeb");
  });

  it("og 태그가 없으면 이유와 함께 실패", () => {
    expect(() => readFeatpaperPage("<html></html>", "https://featpaper.com/u/x")).toThrow(/공유 링크/);
  });
});

describe("공고로 바꾸기", () => {
  it("기업마당·K-Startup 링크는 그 소스의 ID로", () => {
    expect(apiRef("https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179386")).toEqual({ source: "kstartup", externalId: "179386" });
    expect(apiRef("https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000127815")).toEqual({ source: "bizinfo", externalId: "PBLN_000000000127815" });
    expect(apiRef("https://event-us.kr/x/event/1")).toBeNull();
  });

  it("지원사업은 마감일, 행사는 행사일, 투자는 날짜 없음", () => {
    const issue = { id: "i", key: "featpaper:CGhhkscp", title: "t" };
    const grant = rowToAnnouncement(items.find((i) => i.kind === "grant" && i.href?.includes("pbancSn"))!, issue);
    expect(grant.externalId).toMatch(/^kstartup:\d+$/);
    expect(grant.applyEnd?.toISOString()).toMatch(/T15:00:00/); // KST 자정
    expect(grant.category).toBe("지원사업");
    const ev = rowToAnnouncement(items.find((i) => i.text.includes("제주권역"))!, issue);
    expect(ev.applyEnd?.toISOString()).toBe("2026-11-18T15:00:00.000Z");
    const inv = rowToAnnouncement(items.find((i) => i.kind === "investment")!, issue);
    expect(inv.applyEnd).toBeNull();
    expect(inv.category).toBe("투자");
  });
});
