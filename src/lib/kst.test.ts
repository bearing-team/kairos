import { describe, expect, it } from "vitest";
import { formatKstHeaderDate, formatYearsInBusiness, kstYmd, yearsInBusiness } from "./kst";

describe("kst", () => {
  it("UTC 15시 이후는 KST 다음 날", () => {
    expect(kstYmd(new Date("2026-11-22T15:00:00Z"))).toEqual({ year: 2026, month: 11, day: 23 });
    expect(kstYmd(new Date("2026-11-22T14:59:59Z"))).toEqual({ year: 2026, month: 11, day: 22 });
  });

  it("헤더 날짜 형식", () => {
    expect(formatKstHeaderDate(new Date("2026-11-23T00:00:00+09:00"))).toBe("11월 23일 월요일");
  });

  it("업력은 KST 기념일 기준으로 넘어간다", () => {
    const founded = new Date("2025-11-24T00:00:00+09:00");
    expect(yearsInBusiness(founded, new Date("2026-11-23T23:59:00+09:00"))).toBe(0);
    expect(yearsInBusiness(founded, new Date("2026-11-24T00:00:00+09:00"))).toBe(1);
    expect(formatYearsInBusiness(founded, new Date("2026-11-23T12:00:00+09:00"))).toBe("업력 1년 미만");
    expect(formatYearsInBusiness(new Date("2023-01-01T00:00:00+09:00"), new Date("2026-11-23T12:00:00+09:00"))).toBe("업력 3년");
  });
});
