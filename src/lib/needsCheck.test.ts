import { describe, expect, it } from "vitest";
import { charCount, extractChecks, mergeChecks, splitChecks } from "./needsCheck";

describe("【확인 필요】", () => {
  const text = "매출은 【확인 필요: 2025년 매출액】이며 고객은 【확인필요：주요 고객사】, 끝.";

  it("내용을 뽑는다 (띄어쓰기·전각 콜론 허용)", () => {
    expect(extractChecks(text)).toEqual(["2025년 매출액", "주요 고객사"]);
    expect(extractChecks("【확인 필요】")).toEqual(["확인 필요"]);
  });

  it("하이라이트 조각으로 나누고 다시 붙이면 원문", () => {
    const parts = splitChecks(text);
    expect(parts.filter((p) => p.check)).toHaveLength(2);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  });

  it("모델 목록과 합칠 때 중복을 뺀다", () => {
    expect(mergeChecks(text, ["2025년 매출액", "특허 번호"])).toEqual(["2025년 매출액", "주요 고객사", "특허 번호"]);
  });

  it("글자 수는 공백 포함, 한글 1자 = 1", () => {
    expect(charCount("가 나\r\n다")).toBe(5);
  });
});
