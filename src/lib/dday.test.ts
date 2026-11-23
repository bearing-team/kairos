import { describe, expect, it } from "vitest";
import { ddayLabel, periodLabel, timeline } from "./dday";

const kst = (s: string) => new Date(`${s}T00:00:00+09:00`);
const at = (s: string) => new Date(`${s}+09:00`);

describe("timeline", () => {
  const start = kst("2026-11-20");
  const end = kst("2026-12-08");

  it("접수 중: D-day와 진행률", () => {
    const t = timeline(start, end, at("2026-11-23T10:00:00"));
    expect(t).toMatchObject({ phase: "open", daysLeft: 15, urgent: false });
    expect(ddayLabel(t)).toBe("D-15");
    if (t.phase === "open") expect(t.progress).toBeCloseTo(3 / 18);
  });

  it("KST 자정 기준: 마감일 23:59는 오늘 마감, 다음 날 0시는 마감", () => {
    expect(ddayLabel(timeline(start, end, at("2026-12-08T23:59:00")))).toBe("오늘 마감");
    expect(timeline(start, end, at("2026-12-09T00:00:00")).phase).toBe("closed");
    // UTC로는 12-08 15:00 = KST 12-09 00:00
    expect(timeline(start, end, new Date("2026-12-08T15:00:00Z")).phase).toBe("closed");
  });

  it("D-7 이내면 urgent", () => {
    expect(timeline(start, end, at("2026-12-01T09:00:00"))).toMatchObject({ daysLeft: 7, urgent: true });
    expect(timeline(start, end, at("2026-11-30T09:00:00"))).toMatchObject({ daysLeft: 8, urgent: false });
  });

  it("접수 전 / 날짜 없음", () => {
    expect(ddayLabel(timeline(start, end, at("2026-11-12T09:00:00")))).toBe("시작 D-8");
    expect(ddayLabel(timeline(null, null, new Date()))).toBe("상시");
  });

  it("기간 라벨", () => {
    expect(periodLabel(start, end)).toBe("11.20 – 12.08");
    expect(periodLabel(null, null)).toBeNull();
  });
});
