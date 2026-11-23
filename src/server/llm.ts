// server-only를 붙이지 않는다: pnpm sync/score/worker(tsx)에서도 쓴다. 클라이언트 컴포넌트에서 import 금지
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function llmConfigured() {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

export function getLlm(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/** 용도별 모델은 env로 (ARCHITECTURE.md 1절). 없으면 기본값 */
export const MODELS = {
  extract: () => process.env.LLM_MODEL_EXTRACT?.trim() || "claude-opus-5-5",
  score: () => process.env.LLM_MODEL_SCORE?.trim() || "claude-opus-5-5",
  draft: () => process.env.LLM_MODEL_DRAFT?.trim() || "claude-opus-5-5",
};
