import { describe, expect, it } from "vitest";
import { allowedNext, checkTransition } from "./transitions";

describe("상태 전이", () => {
  it("정상 흐름", () => {
    for (const [a, b] of [["new", "triage"], ["triage", "drafting"], ["drafting", "review"], ["review", "submitted"], ["submitted", "result_pass"]] as const) {
      expect(checkTransition(a, b)).toEqual({ ok: true });
    }
  });
  it("건너뛰기·되돌리기 제한", () => {
    expect(checkTransition("new", "submitted").ok).toBe(false);
    expect(checkTransition("result_pass", "excluded").ok).toBe(false);
    expect(checkTransition("drafting", "drafting").ok).toBe(false);
  });
  it("제외는 사유 필수, 어느 진행 단계에서든", () => {
    expect(checkTransition("review", "excluded", "")).toEqual({ ok: false, error: "제외 사유를 적어 주세요" });
    expect(checkTransition("review", "excluded", "일정이 안 맞음").ok).toBe(true);
    expect(allowedNext("excluded")).toEqual(["triage"]);
  });
});
