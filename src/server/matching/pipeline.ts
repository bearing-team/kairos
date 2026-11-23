import { refreshMatches, scorePending, type RefreshResult, type ScoreRunResult } from "./run";

/** 소싱 뒤에 도는 매칭: 하드필터 전체 → 점수 대기분 limit개 */
export async function matchAfterSync(opts: { limit?: number } = {}): Promise<{ refresh: RefreshResult; score: ScoreRunResult }> {
  const refresh = await refreshMatches();
  const score = await scorePending(opts);
  return { refresh, score };
}

export function describeMatch({ refresh, score }: { refresh: RefreshResult; score: ScoreRunResult }) {
  const s = score.skipped === "no-key" ? `점수 대기 ${score.remaining}건 (ANTHROPIC_API_KEY 없음)` : `점수 ${score.scored}건${score.failed ? ` · 실패 ${score.failed}` : ""} · 남은 대기 ${score.remaining}`;
  return `규칙 검사 ${refresh.checked}건 (새 ${refresh.created}, 제외 ${refresh.excluded}, 복귀 ${refresh.restored}) · ${s}`;
}
