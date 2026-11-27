import { describe, expect, it } from "vitest";
import { mention, workRequestText } from "./messages";
import { dueLabel } from "@/components/requests/view";
import { requestHref } from "@/lib/requests";

describe("구성원 요청 Slack 문장", () => {
  it("Slack 멤버 ID가 있으면 멘션, 없으면 굵은 이름", () => {
    expect(mention({ name: "김하나", email: "a@b.c", slackUserId: "U0ABC123" })).toBe("<@U0ABC123>");
    expect(mention({ name: "김하나", email: "a@b.c", slackUserId: null })).toBe("*김하나*");
    expect(mention({ name: "<김>", email: null, slackUserId: "bad id" })).toBe("*&lt;김&gt;*");
  });

  it("종류별 조사·섹션·메시지 인용·기한", () => {
    const text = workRequestText({
      kind: "supplement",
      to: "<@U1>",
      from: "이둘",
      title: "창업도약패키지",
      url: "https://kairos.example/applications/a/draft",
      sectionTitle: "시장 분석",
      message: "최근 3년 수치\n출처도 <꼭>",
      dueAt: new Date("2026-12-03T14:59:59Z"),
    });
    expect(text.split("\n")).toEqual([
      "<@U1> 님, 이둘님이 <https://kairos.example/applications/a/draft|창업도약패키지> ‘시장 분석’ 보강을 요청했어요",
      "> 최근 3년 수치",
      "> 출처도 &lt;꼭&gt;",
      "기한: 12.03까지",
    ]);
    expect(workRequestText({ kind: "review", to: "*A*", from: "B", title: "T", url: null, sectionTitle: null, message: "", dueAt: null })).toBe("*A* 님, B님이 T 리뷰를 요청했어요");
  });
});

describe("요청 기한·링크", () => {
  const now = new Date("2026-11-27T01:00:00Z"); // 금 10:00 KST
  it("KST 날짜로 남은 날을 센다", () => {
    expect(dueLabel(new Date("2026-11-27T14:59:59Z"), now)).toEqual({ label: "11.27(금) · 오늘까지", urgent: true, overdue: false });
    expect(dueLabel(new Date("2026-11-28T14:59:59Z"), now).label).toBe("11.28(토) · 내일까지");
    expect(dueLabel(new Date("2026-12-03T14:59:59Z"), now)).toEqual({ label: "12.03(목) · D-6", urgent: false, overdue: false });
    expect(dueLabel(new Date("2026-11-25T14:59:59Z"), now)).toEqual({ label: "11.25(수) · 2일 지남", urgent: true, overdue: true });
  });
  it("섹션이 있으면 그 버전·위치로", () => {
    expect(requestHref("a1", null)).toBe("/applications/a1/draft");
    expect(requestHref("a1", { order: 3, draft: { version: 2 } })).toBe("/applications/a1/draft?v=2#sec-3");
  });
});
