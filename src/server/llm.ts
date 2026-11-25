// server-only를 붙이지 않는다: pnpm sync/score/worker(tsx)에서도 쓴다. 클라이언트 컴포넌트에서 import 금지
import Anthropic from "@anthropic-ai/sdk";
import { secret } from "@/server/secrets";

let client: { key: string; llm: Anthropic } | null = null;

/** 키는 .env 또는 화면에서 넣은 값 (src/server/secrets.ts) */
export function llmConfigured() {
  return !!secret("ANTHROPIC_API_KEY");
}

/** 키가 바뀌면 새 클라이언트를 만든다 */
export function getLlm(): Anthropic {
  const key = secret("ANTHROPIC_API_KEY") ?? "";
  if (client?.key !== key) client = { key, llm: new Anthropic({ apiKey: key }) };
  return client.llm;
}

/** 용도별 모델은 env로 (ARCHITECTURE.md 1절). 없으면 기본값 */
export const MODELS = {
  extract: () => process.env.LLM_MODEL_EXTRACT?.trim() || "claude-opus-5-5",
  score: () => process.env.LLM_MODEL_SCORE?.trim() || "claude-opus-5-5",
  draft: () => process.env.LLM_MODEL_DRAFT?.trim() || "claude-opus-5-5",
};
