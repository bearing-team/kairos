import { afterEach, describe, expect, it } from "vitest";
import { deadlineAlertText, deadlineBucket, deadlineText, digestText, type NotifyItem } from "./messages";
import { link, webhookUrl } from "./slack";

const kst = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`);
const NOW = new Date("2026-11-23T00:30:00Z"); // 월 09:30 KST
const item = (o: Partial<NotifyItem>): NotifyItem => ({
  applicationId: "app", announcementId: "ann", title: "공고", url: "https://example.go.kr/1",
  applyStart: kst("2026-11-20"), applyEnd: kst("2026-12-08"), score: null, status: "new", ...o,
});

describe("다이제스트 (ARCHITECTURE.md 7절 형식)", () => {
  it("링크·공고명·마감·점수·상태", () => {
    const text = digestText(
      [
        item({ title: "2027년 초기창업패키지", score: 92, status: "drafting" }),
        item({ title: "부산 SW기업 성장지원사업", applyStart: kst("2026-11-17"), applyEnd: kst("2026-11-28"), status: "review" }),
        item({ title: "2027년 AI 바우처 공급기업", applyStart: kst("2026-12-01"), applyEnd: kst("2026-12-19") }),
      ],
      NOW,
      "https://grants.example.com",
    );
    expect(text).toBe(
      [
        "*이번 주에 챙길 공고 3개*",
        "• <https://example.go.kr/1|2027년 초기창업패키지> — 12.08 마감 (D-15) · 적합 92 · 초안 작성 중",
        "• <https://example.go.kr/1|부산 SW기업 성장지원사업> — 11.28 마감 (D-5) · 리뷰 중",
        "• <https://example.go.kr/1|2027년 AI 바우처 공급기업> — 12.19 마감 · 12.01 접수 시작 · 새 공고",
        "전체 보기: <https://grants.example.com|grants.example.com>",
      ].join("\n"),
    );
  });
  it("원문이 없으면 앱 상세 링크, 없으면 빈 안내", () => {
    expect(digestText([item({ url: null })], NOW, "https://app.test")).toContain("<https://app.test/announcements/ann|공고>");
    expect(digestText([], NOW, null)).toBe("*이번 주에 챙길 공고가 없어요*");
  });
  it("마감 문구: 오늘·상시", () => {
    expect(deadlineText({ applyStart: null, applyEnd: kst("2026-11-23") }, NOW)).toBe("11.23 마감 (오늘 마감)");
    expect(deadlineText({ applyStart: null, applyEnd: null }, NOW)).toBe("상시 접수");
  });
});

describe("Slack 링크 이스케이프", () => {
  it("공고명의 <, >, &, | 가 링크를 깨지 않는다", () => {
    expect(link("https://a.kr/x?a=1&b=2", "R&D <특별> | 공고")).toBe("<https://a.kr/x?a=1&b=2|R&amp;D &lt;특별&gt; ¦ 공고>");
    expect(link("javascript:alert(1)", "x")).toBe("x");
  });
});

describe("마감 알림 구간", () => {
  it("D-7/D-3/D-1, 놓친 날은 다음 구간에서", () => {
    expect([8, 7, 5, 3, 2, 1, 0, -1].map(deadlineBucket)).toEqual([null, 7, 7, 3, 3, 1, 1, null]);
  });
  it("문구", () => {
    const t = deadlineAlertText([item({ applyEnd: kst("2026-11-26"), status: "review" })], NOW, "https://app.test");
    expect(t).toBe("*마감이 다가오는 공고 1개*\n• <https://example.go.kr/1|공고> — *D-3* · 리뷰 중 · <https://app.test/announcements/ann|열기>");
  });
});

describe("웹훅 주소 검사", () => {
  const prev = process.env.SLACK_WEBHOOK_URL;
  afterEach(() => {
    process.env.SLACK_WEBHOOK_URL = prev;
  });
  it("Slack 공식 주소와 개발용 로컬만", () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T/B/x";
    expect("url" in webhookUrl()).toBe(true);
    process.env.SLACK_WEBHOOK_URL = "https://evil.example.com/services/x";
    expect("error" in webhookUrl()).toBe(true);
    process.env.SLACK_WEBHOOK_URL = "http://127.0.0.1:9999/hook";
    expect("url" in webhookUrl()).toBe(true);
  });
});
