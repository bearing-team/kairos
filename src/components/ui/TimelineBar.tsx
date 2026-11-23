import { ddayLabel, periodLabel, type Timeline } from "@/lib/dday";

/**
 * 시그니처: 접수 기간 바 + 오늘 위치 점. D-7 이내면 주황 (DESIGN.md 4절)
 * 바는 aria-hidden, 정보는 텍스트(기간·D-day)가 전달한다
 */
export function TimelineBar({ t, start, end, label = true }: { t: Timeline; start: Date | null; end: Date | null; label?: boolean }) {
  const period = periodLabel(start, end);
  const urgent = t.phase === "open" && t.urgent;
  const progress = t.phase === "open" ? t.progress : 0;
  const color = urgent ? "var(--color-urgent)" : t.phase === "open" ? "var(--color-accent)" : "var(--color-timeline-idle)";
  const showBar = t.phase === "open" || t.phase === "upcoming";

  return (
    <div className="flex w-full flex-col gap-2">
      {label ? (
        <div className="flex justify-between gap-2 text-[12px] leading-[1.4] font-semibold">
          <span className="text-ink-3">{period ?? "기간 정보 없음"}</span>
          <span className={urgent ? "font-bold text-urgent-text" : "font-bold text-ink-2"}>{ddayLabel(t)}</span>
        </div>
      ) : null}
      {showBar ? (
        <div aria-hidden="true" className="relative h-1 rounded-full bg-track">
          <div className="h-1 rounded-full" style={{ width: `${progress * 100}%`, background: color }} />
          <div
            className="absolute top-[-3px] size-2.5 rounded-full"
            style={{ left: `${progress * 100}%`, marginLeft: -5, background: color, boxShadow: "0 0 0 3px var(--color-surface)" }}
          />
        </div>
      ) : (
        <div aria-hidden="true" className="h-1 rounded-full bg-track" />
      )}
    </div>
  );
}
