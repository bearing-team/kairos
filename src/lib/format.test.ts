import { describe, expect, it } from "vitest";
import { withRo } from "./format";

describe("withRo", () => {
  it("받침에 맞춰 로/으로", () => {
    expect(withRo("리뷰 중")).toBe("리뷰 중으로");
    expect(withRo("추천됨")).toBe("추천됨으로");
    expect(withRo("제출 완료")).toBe("제출 완료로");
    expect(withRo("서울")).toBe("서울로");
    expect(withRo("M5")).toBe("M5(으)로");
  });
});
