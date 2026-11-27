import { describe, expect, it } from "vitest";
import { hashPassword, normalizeCompanyName, verifyPassword } from "./password";

describe("password", () => {
  it("해시한 비밀번호만 맞다고 한다", async () => {
    const h = await hashPassword("correct horse");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong horse", h)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("normalizeCompanyName", () => {
  it("법인 표기·공백을 빼고 비교한다", () => {
    const base = normalizeCompanyName("베어링(주)");
    expect(base).toBe("베어링");
    expect(normalizeCompanyName("주식회사 베어링")).toBe(base);
    expect(normalizeCompanyName("㈜ 베어링")).toBe(base);
    expect(normalizeCompanyName(" 베어링 ")).toBe(base);
    expect(normalizeCompanyName("Bearing Co., Ltd.")).toBe("bearing");
    expect(normalizeCompanyName("베어링랩")).not.toBe(base);
  });
});
