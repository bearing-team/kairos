import { describe, expect, it } from "vitest";
import { bizinfoLinks, classifyAttachment, kstartupLinks, genericLinks } from "./links";
import { rankForms } from "./attachments";
import { pickTemplate } from "./templates";

// 실제 상세 페이지 구조를 줄인 것 (2026-11 확인)
const BIZ = `<ul><li>
  <div class="file_name">(양식1)사업계획서.hwpx</div>
  <div class="right_btn">
    <a href="javascript:void(0);" class="directViewBtn" onclick="fileBlank('/webapp/upload/x.hwpx')">바로보기</a>
    <a href="/cmm/fms/fileDown.do?atchFileId=FILE_1&amp;fileSn=0&amp;downloadToken=abc" class="icon_download">다운로드</a>
  </div></li>
  <li><div class="file_name">공고문.pdf</div><a href="/cmm/fms/fileDown.do?atchFileId=FILE_1&amp;fileSn=1&amp;downloadToken=def">다운로드</a></li>
  <li>메뉴</li></ul>`;
const KS = `<div class="board_file"><ul>
  <li class="clear"><a class="file_bg" title="[첨부파일] 2. 입주신청서(별지1호).hwpx">2. 입주신청서(별지1호).hwpx</a>
  <div class="btn_wrap"><ul><li><a href="javascript:void(0)" onclick="fnPdfView('x')" class="btn_view">바로보기</a></li>
  <li><a href="/afile/fileDownload/v1oOFt" class="btn_down">다운로드</a></li></ul></div></li></ul></div>`;

describe("첨부 링크 찾기", () => {
  it("기업마당: 이름 + 토큰 있는 다운로드 링크", () => {
    expect(bizinfoLinks(BIZ, "https://www.bizinfo.go.kr/web/view.do")).toEqual([
      { fileName: "(양식1)사업계획서.hwpx", url: "https://www.bizinfo.go.kr/cmm/fms/fileDown.do?atchFileId=FILE_1&fileSn=0&downloadToken=abc" },
      { fileName: "공고문.pdf", url: "https://www.bizinfo.go.kr/cmm/fms/fileDown.do?atchFileId=FILE_1&fileSn=1&downloadToken=def" },
    ]);
  });

  it("K-Startup: title의 [첨부파일] 떼고, 바로보기는 무시", () => {
    expect(kstartupLinks(KS, "https://www.k-startup.go.kr/web/contents/x.do")).toEqual([
      { fileName: "2. 입주신청서(별지1호).hwpx", url: "https://www.k-startup.go.kr/afile/fileDownload/v1oOFt" },
    ]);
  });

  it("그 밖의 페이지: 확장자가 보이는 링크만", () => {
    const html = `<a href="/files/plan.hwp">사업계획서 양식.hwp</a><a href="/about">소개</a><a href="javascript:x('a.pdf')">a.pdf</a>`;
    expect(genericLinks(html, "https://example.org/notice/1")).toEqual([{ fileName: "사업계획서 양식.hwp", url: "https://example.org/files/plan.hwp" }]);
  });
});

describe("첨부 종류·양식 고르기·템플릿", () => {
  it("이름으로 종류 추정 (양식 > 공고문)", () => {
    expect(classifyAttachment("붙임2. 신청 양식.hwpx")).toBe("form");
    expect(classifyAttachment("2026 공고문 및 신청서.hwp")).toBe("form");
    expect(classifyAttachment("모집 공고.pdf")).toBe("notice");
    expect(classifyAttachment("포스터.png")).toBe("other");
  });

  it("사업계획서를 신청서보다 먼저", () => {
    const rows = [
      { id: "a", fileName: "신청서.hwp", kind: "form", text: "x".repeat(900) },
      { id: "b", fileName: "사업 계획서.hwpx", kind: "form", text: "x".repeat(100) },
      { id: "c", fileName: "공고문.pdf", kind: "notice", text: "x".repeat(9000) },
      { id: "d", fileName: "서식.hwp", kind: "form", text: null },
    ];
    expect(rankForms(rows).map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("기본 템플릿 고르기", () => {
    expect(pickTemplate({ title: "2027 수출바우처 참여기업 모집", category: null })).toBe("voucher");
    expect(pickTemplate({ title: "중소기업 기술개발사업 공고", category: null })).toBe("rnd");
    expect(pickTemplate({ title: "초기창업패키지", category: "창업" })).toBe("startup");
  });
});
