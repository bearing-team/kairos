import { describe, expect, it } from "vitest";
import { lineDiff } from "./diff";

describe("lineDiff", () => {
  it("바뀐 줄만 빼고 더한다", () => {
    expect(lineDiff("가\n나\n다", "가\n나2\n다\n라")).toEqual([
      { type: "same", text: "가" },
      { type: "del", text: "나" },
      { type: "add", text: "나2" },
      { type: "same", text: "다" },
      { type: "add", text: "라" },
    ]);
  });
  it("같으면 전부 same", () => {
    expect(lineDiff("a\nb", "a\nb").every((l) => l.type === "same")).toBe(true);
  });
});
