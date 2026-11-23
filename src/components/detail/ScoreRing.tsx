/**
 * 적합도 링. 히어로가 없는 상세 화면의 유일한 그라데이션 (DESIGN.md 5.3)
 * 숫자가 정보를 전달하고 링은 장식(aria-hidden)
 */
export function ScoreRing({ score }: { score: number }) {
  const p = Math.max(0, Math.min(100, score));
  return (
    <div className="relative size-[120px] flex-none">
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#3A63F5 0%, #6A5CF6 ${p * 0.55}%, #9457D2 ${p}%, var(--color-track) ${p}% 100%)`,
          mask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 9px))",
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 9px))",
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[36px] leading-none font-extrabold tracking-[-0.04em]">{score}</span>
        <span className="mt-1 text-[12px] font-semibold text-ink-3">적합도</span>
      </div>
    </div>
  );
}
