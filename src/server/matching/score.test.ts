import { beforeEach, describe, expect, it, vi } from "vitest";

// LLM 호출은 가짜로 바꾼다 (실제 API·비용 없이 재시도·정리 규칙만 확인)
const parse = vi.fn();
vi.mock("@/server/llm", () => ({ getLlm: () => ({ messages: { parse } }), MODELS: { score: () => "test-model" }, llmConfigured: () => true }));

const { scoreAnnouncement } = await import("./score");
const { scoreSystem } = await import("@/server/prompts/score.v1");

const now = new Date("2026-11-23T03:00:00Z");
const ctx = {
  company: { name: "베어링(주)", industryLabel: "SW 스타트업", region: "부산", bizType: "corporation" as const, foundedAt: null, headcount: 4, revenueBand: null, ceoBirthYear: null, certifications: [], ksicCodes: [], description: null },
  cards: [{ id: "card1", name: "ONDECKK", problem: null, solution: null, customer: null, differentiation: null, traction: null }],
  history: [],
  now,
};
const ann = { title: "테스트 공고", organization: "창업진흥원", executingOrg: null, target: null, regionLimit: null, applyPeriodText: null, supportAmountText: null, category: null, hashtags: [], summary: "요약" };
const ok = (o: object) => ({ stop_reason: "end_turn", parsed_output: { score: 80, reasons: [], risks: [], suggestedItemCard: null, eligibility: "eligible", ...o } });

beforeEach(() => parse.mockReset());

describe("scoreAnnouncement", () => {
  it("결과를 정리하고 아이템 카드 이름을 id로 바꾼다", async () => {
    parse.mockResolvedValueOnce(ok({ score: 104.4, reasons: ["a", " ", "b", "c", "d"], suggestedItemCard: "ONDECKK" }));
    const r = await scoreAnnouncement(ctx, ann, []);
    expect(r).toMatchObject({ ok: true, suggestedItemCardId: "card1", promptVersion: "score.v1", output: { score: 100, reasons: ["a", "b", "c"] } });
  });
  it("검증 실패 뒤 한 번 더 시도해서 성공", async () => {
    parse.mockRejectedValueOnce(new Error("zod")).mockResolvedValueOnce(ok({ score: 70 }));
    expect((await scoreAnnouncement(ctx, ann, [])).ok).toBe(true);
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("두 번 다 실패하면 오류로 남긴다 (세 번째는 없음)", async () => {
    parse.mockRejectedValueOnce(new Error("zod")).mockRejectedValueOnce(new Error("zod"));
    const r = await scoreAnnouncement(ctx, ann, []);
    expect(r.ok).toBe(false);
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("거절은 재시도 없이 실패", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "refusal", parsed_output: null });
    expect(await scoreAnnouncement(ctx, ann, [])).toEqual({ ok: false, error: "모델이 응답을 거절했어요" });
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("회사 정보가 없으면 프롬프트에 없다고 적는다 (지어내지 않게)", () => {
    const s = scoreSystem(ctx.company, [], [], now);
    expect(s).toContain("설립일: (프로필에 없음)");
    expect(s).toContain("(아이템 카드 없음)");
    expect(s).not.toContain("매출 구간");
  });
});
