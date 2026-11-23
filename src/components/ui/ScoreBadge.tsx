import type { ScoreStatus } from "@/generated/prisma/enums";

export function scoreTone(score: number) {
  return score >= 85
    ? { bg: "var(--score-high-bg)", fg: "var(--score-high-fg)" }
    : score >= 70
      ? { bg: "var(--score-mid-bg)", fg: "var(--score-mid-fg)" }
      : { bg: "var(--score-low-bg)", fg: "var(--score-low-fg)" };
}

const PENDING_LABEL: Partial<Record<ScoreStatus, string>> = {
  pending: "점수 대기",
  running: "점수 매기는 중",
  failed: "점수를 못 매겼어요",
};

/** 리스트 배지 48×48 (DESIGN.md ScoreBadge). 하드필터 탈락이면 숫자 없이 빈 자리 */
export function ScoreBadge({ score, status }: { score: number | null; status: ScoreStatus | null }) {
  if (score !== null) {
    const t = scoreTone(score);
    return (
      <span
        className="flex size-12 flex-none items-center justify-center rounded-lg text-[17px] font-extrabold"
        style={{ background: t.bg, color: t.fg }}
        aria-label={`적합도 ${score}`}
      >
        {score}
      </span>
    );
  }
  const label = status ? PENDING_LABEL[status] : undefined;
  if (!label) return <span aria-hidden="true" className="size-12 flex-none rounded-lg bg-[var(--score-low-bg)]" />;
  return (
    <span
      title={label}
      aria-label={label}
      className={`flex size-12 flex-none items-center justify-center rounded-lg bg-[var(--score-low-bg)] text-[15px] font-bold text-ink-3 ${status === "running" ? "animate-pulse" : ""}`}
    >
      –
    </span>
  );
}
