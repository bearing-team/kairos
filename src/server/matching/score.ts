import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getLlm, MODELS } from "@/server/llm";
import { SCORE_PROMPT_VERSION, ScoreSchema, scoreSystem, scoreUserMessage, type ScoreAnnouncement, type ScoreCompany, type ScoreHistory, type ScoreItemCard, type ScoreOutput } from "@/server/prompts/score.v1";

export type ScoreContext = { company: ScoreCompany; cards: (ScoreItemCard & { id: string })[]; history: ScoreHistory[]; now: Date };
export type ScoreResult =
  | { ok: true; output: ScoreOutput; suggestedItemCardId: string | null; model: string; promptVersion: string }
  | { ok: false; error: string };

const clean = (xs: string[], max: number) => xs.map((s) => s.trim()).filter(Boolean).slice(0, max);

/** LLM 1회 호출. 스키마 검증 실패면 1번만 다시 시도 (ARCHITECTURE.md 11절) */
export async function scoreAnnouncement(ctx: ScoreContext, a: ScoreAnnouncement, filterNotes: string[]): Promise<ScoreResult> {
  const model = MODELS.score();
  const system = scoreSystem(ctx.company, ctx.cards, ctx.history, ctx.now);
  const user = scoreUserMessage(a, filterNotes, ctx.now);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await getLlm().messages.parse({
        model,
        max_tokens: 8000,
        output_config: { effort: "low", format: zodOutputFormat(ScoreSchema) },
        // 규칙+회사 정보는 실행 내내 같다 → 캐시
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      });
      if (response.stop_reason === "refusal") return { ok: false, error: "모델이 응답을 거절했어요" };
      if (response.stop_reason === "max_tokens") {
        if (attempt === 2) return { ok: false, error: "응답이 잘렸어요" };
        continue;
      }
      const out = response.parsed_output;
      if (!out) {
        if (attempt === 2) return { ok: false, error: "응답 형식이 맞지 않아요" };
        continue;
      }
      const output: ScoreOutput = {
        ...out,
        score: Math.max(0, Math.min(100, Math.round(out.score))),
        reasons: clean(out.reasons, 3),
        risks: clean(out.risks, 4),
      };
      const card = output.suggestedItemCard ? ctx.cards.find((c) => c.name.trim() === output.suggestedItemCard!.trim()) : undefined;
      return { ok: true, output, suggestedItemCardId: card?.id ?? null, model, promptVersion: SCORE_PROMPT_VERSION };
    } catch (e) {
      // 스키마(zod) 검증 실패는 한 번 더. API 오류는 SDK가 이미 재시도했으니 바로 실패
      if (e instanceof Anthropic.APIError) {
        const msg =
          e instanceof Anthropic.RateLimitError
            ? "요청 한도에 걸렸어요"
            : e instanceof Anthropic.AuthenticationError
              ? "ANTHROPIC_API_KEY가 올바르지 않아요"
              : `API 오류 (${e.status ?? "연결"})`;
        return { ok: false, error: msg };
      }
      if (attempt === 2) return { ok: false, error: `응답 검증 실패: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` };
    }
  }
  return { ok: false, error: "점수를 매기지 못했어요" };
}
