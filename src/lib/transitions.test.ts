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
    expect(allowedNext("excluded")).toEqual(["triage", "interested"]);
  });
  it("1차 분류: 새 공고·검토 전 → 관심 / 제외, 관심 해제는 검토 전으로", () => {
    for (const from of ["new", "triage"] as const) {
      expect(checkTransition(from, "interested").ok).toBe(true);
      expect(checkTransition(from, "excluded", "관심 없음").ok).toBe(true);
    }
    expect(checkTransition("interested", "triage").ok).toBe(true);
    expect(checkTransition("interested", "drafting").ok).toBe(true);
    expect(checkTransition("interested", "excluded", "분야 다름").ok).toBe(true);
    expect(checkTransition("interested", "new").ok).toBe(false);
  });
});
