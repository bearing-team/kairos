import { describe, expect, it } from "vitest";
import { hasApplyPeriod, pickNotice } from "./noticeAttachment";
import { urlExtractUserMessage } from "@/server/prompts/url-extract.v2";

describe("hasApplyPeriod", () => {
  it("등록일과 D-day만 있는 글은 기간이 없다고 본다 (bipa.kr)", () => {
    expect(hasApplyPeriod("사업공고\nD-12\nK-해양 AI 벨트 얼라이언스 참여 수요조사\n등록일\n2026-11-24\n조회수\n1056\n첨부파일")).toBe(false);
  });
  it("접수 기간 줄이 있으면 본문으로 충분하다", () => {
    expect(hasApplyPeriod("□ 접수기간 : 2026. 11. 19.(수) ~ 12. 23.(화) 18:00")).toBe(true);
    expect(hasApplyPeriod("신청 기간\n2026-11-20 ~ 2026-12-08")).toBe(true);
    expect(hasApplyPeriod("2026년 12월 8일(월)까지 이메일로 제출")).toBe(true);
  });
});

describe("pickNotice", () => {
  it("양식이 아닌 공고문 첨부를 고른다. 사이트 공통 안내 PDF는 고르지 않는다", () => {
    const links = [
      { fileName: "안내.pdf", url: "https://bipa.kr/uploads/file/a.pdf" },
      { fileName: "2. (참여의향서) K-해양 AI 벨트 얼라이언스.hwp", url: "https://bipa.kr/download/20062" },
      { fileName: "1. (공고문) K-해양 AI 벨트 얼라이언스 참여 수요조사.hwp", url: "https://bipa.kr/download/20061" },
    ];
    expect(pickNotice(links)?.url).toBe("https://bipa.kr/download/20061");
  });
  it("공고문이 없거나 읽을 수 없는 형식이면 null", () => {
    expect(pickNotice([{ fileName: "신청서 양식.hwp", url: "https://x/1" }])).toBeNull();
    expect(pickNotice([{ fileName: "공고문.zip", url: "https://x/2" }])).toBeNull();
  });
});

describe("urlExtractUserMessage", () => {
  it("공고문 본문을 <attachment>로 붙인다", () => {
    const msg = urlExtractUserMessage({ url: "https://bipa.kr/v", title: "t", text: "본문" }, [{ fileName: '공고문 "최종".hwp', text: "(모집기간) 2026. 11. 24. ~ 12. 9." }]);
    expect(msg).toContain("<page>\n본문\n</page>");
    expect(msg).toContain(`<attachment name="공고문 '최종'.hwp">\n(모집기간) 2026. 11. 24. ~ 12. 9.\n</attachment>`);
  });
  it("첨부가 없으면 v1과 같은 모양", () => {
    expect(urlExtractUserMessage({ url: "u", title: null, text: "b" })).not.toContain("<attachment");
  });
});
