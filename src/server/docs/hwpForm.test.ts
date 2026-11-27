import { describe, expect, it } from "vitest";
import { breakLines, choiceOptions } from "./hwpForm";

// 실제 양식 파일(참여의향서 HWP)로 한 채우기 확인은 fixtures 밖에서 했다 (양식 샘플은 커밋하지 않음)
describe("choiceOptions", () => {
  it("□로 나뉜 보기를 뽑고 '기타(   )'는 '기타'로", () => {
    expect(choiceOptions("□ 기업   □ 대학   □ 연구소  □ 공공기관 □ 협단체 □ 기타(        )")).toEqual(["기업", "대학", "연구소", "공공기관", "협단체", "기타"]);
    expect(choiceOptions("□ 국방   □ 항만   □ 조선  □ 문화")).toEqual(["국방", "항만", "조선", "문화"]);
  });
  it("보기 뒤 설명(괄호·콜론)은 뺀다", () => {
    expect(choiceOptions("□ 예비창업자(사업자 없음) □ 기창업자: 7년 이내")).toEqual(["예비창업자", "기창업자"]);
  });
});

describe("breakLines", () => {
  it("줄 폭을 넘기면 띄어쓰기에서 끊는다", () => {
    // 한글 4글자 = 4em, 공백 0.5em
    expect(breakLines("가나다라 마바사아 자차카타", 9)).toEqual([0, 10]);
  });
  it("줄바꿈에서 끊는다", () => {
    expect(breakLines("첫 줄\n둘째 줄", 40)).toEqual([0, 4]);
  });
  it("띄어쓰기가 없으면 글자에서 끊는다", () => {
    expect(breakLines("가나다라마바사", 3)).toEqual([0, 3, 6]);
  });
});
