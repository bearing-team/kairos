import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalLink, readListPage } from "./boardList";

const fx = (name: string) => readFileSync(`fixtures/boards/${name}`, "utf8");

describe("readListPage", () => {
  it("전북TP: 글 링크와 그 줄(마감일 포함)을 뽑는다", () => {
    const p = readListPage(fx("jbtp-list-20261125.html"), "https://www.jbtp.or.kr/board/list.jbtp?boardId=BBS_0000006&menuCd=DOM_000000102001000000&contentsSid=12");
    const post = p.links.find((l) => l.text.includes("전북형 스마트 제조AI 시범공장"));
    expect(post?.href).toBe("https://www.jbtp.or.kr/board/view.jbtp?menuCd=DOM_000000102001000000&boardId=BBS_0000006&dataSid=21231");
    expect(post?.context).toContain("2026-12-11");
    expect(p.linkRows).toBeGreaterThanOrEqual(3);
  });

  it("부산TP: 상대 주소(?mCode=…)를 목록 주소 기준으로 푼다", () => {
    const p = readListPage(fx("btp-list-20261125.html"), "https://www.btp.or.kr/kor/CMS/Board/Board.do?mCode=MN013");
    const post = p.links.find((l) => l.text.includes("스마트공장 구축지원사업"));
    expect(post?.href).toMatch(/^https:\/\/www\.btp\.or\.kr\/kor\/CMS\/Board\/Board\.do\?mCode=MN013&mode=view&/);
    expect(post?.context).toContain("접수기간");
  });

  it("중기부: 글을 스크립트로 여는 줄을 센다 (글 링크는 없다)", () => {
    const p = readListPage(fx("mss-list-20261125.html"), "https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310");
    expect(p.scriptRows).toBeGreaterThanOrEqual(3);
    expect(p.linkRows).toBeLessThan(3);
  });

  it("자기 자신·첨부·javascript 링크는 뺀다", () => {
    const html = `<a href="/list">목록 페이지</a><a href="javascript:go(1)">스크립트 글 제목</a><a href="/f/a.hwp">첨부 파일입니다</a><a href="/view?id=1">진짜 글 제목</a>`;
    const p = readListPage(html, "https://ex.kr/list");
    expect(p.links.map((l) => l.href)).toEqual(["https://ex.kr/view?id=1"]);
  });
});

describe("canonicalLink", () => {
  it("해시와 jsessionid를 지운다", () => {
    expect(canonicalLink("https://ex.kr/view.do;jsessionid=AB12?id=3#top")).toBe("https://ex.kr/view.do?id=3");
  });
});
