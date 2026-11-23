import Link from "next/link";
import { Check } from "lucide-react";
import { TimelineBar } from "@/components/ui/TimelineBar";
import { StatusButton } from "@/components/announcements/StatusButton";
import { timeline } from "@/lib/dday";
import type { AppRow } from "@/server/matches";

const onHero =
  "inline-flex h-12 items-center justify-center rounded-full border-0 bg-white px-6 text-[15px] font-bold text-[var(--hero-primary-fg)] transition-transform duration-[120ms] active:scale-[0.98] disabled:opacity-60";
const ghostOnHero =
  "inline-flex h-12 items-center justify-center rounded-full border border-[var(--hero-ghost-border)] bg-transparent px-5 text-[15px] font-semibold text-white transition-colors duration-[120ms] hover:bg-white/10";

/** 홈 히어로 "가장 잘 맞는 공고" — 화면에서 그라데이션은 여기 한 곳 (DESIGN.md FocusHeroCard) */
export function FocusHeroCard({ r, now, progress }: { r: AppRow; now: Date; progress?: { done: number; total: number } | null }) {
  const a = r.announcement;
  const reasons = (Array.isArray(r.match.reasons) ? (r.match.reasons as string[]) : []).slice(0, 3);
  const detail = `/announcements/${a.id}`;
  const meta = [a.organization, a.supportAmountText].filter(Boolean).join(" · ");

  return (
    <article
      className="animate-rise flex min-w-0 flex-[1.5_1_440px] flex-col gap-6 rounded-2xl p-6 text-white md:p-8"
      style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-hero)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[14px] font-semibold">가장 잘 맞는 공고</span>
          <h2 className="m-0 text-[24px] leading-[1.35] font-extrabold tracking-[-0.02em] md:text-[28px]">
            <Link href={detail} className="hover:underline hover:underline-offset-4">
              {a.title}
            </Link>
          </h2>
          {meta ? <span className="text-[14px]">{meta}</span> : null}
        </div>
        <div className="flex flex-none flex-col items-end gap-0.5">
          <span className="text-[48px] leading-none font-extrabold tracking-[-0.04em] md:text-[56px]">{r.match.score}</span>
          <span className="text-[13px] font-semibold">적합도</span>
        </div>
      </div>

      {reasons.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="맞는 이유">
          {reasons.map((t) => (
            <li key={t} className="flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: "var(--hero-chip-bg)" }}>
              <Check size={14} strokeWidth={2.6} aria-hidden="true" className="flex-none" />
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      <TimelineBar variant="hero" t={timeline(a.applyStart, a.applyEnd, now)} start={a.applyStart} end={a.applyEnd} />

      <div className="flex flex-wrap items-center gap-3">
        {r.status === "drafting" ? (
          <Link href={`/applications/${r.id}/draft`} className={onHero}>
            초안 이어 쓰기
          </Link>
        ) : (
          <StatusButton applicationId={r.id} to="drafting" label="초안 만들기" pendingLabel="시작하는 중" redirectTo={`/applications/${r.id}/draft`} className={onHero} />
        )}
        {a.url ? (
          <a href={a.url} target="_blank" rel="noreferrer" className={ghostOnHero}>
            공고문 보기
          </a>
        ) : null}
        {progress && progress.total ? (
          <span className="text-[14px] font-medium">
            사업계획서 초안 {progress.done}/{progress.total} 섹션 완료
          </span>
        ) : null}
      </div>
    </article>
  );
}
