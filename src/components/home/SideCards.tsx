import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { StatusButton } from "@/components/announcements/StatusButton";
import { buttonClass } from "@/components/ui/Button";
import { ddayLabel, timeline } from "@/lib/dday";
import { kstYmd } from "@/lib/kst";
import { STATUS_STYLE } from "@/lib/status";
import type { AppRow } from "@/server/matches";

const card = "animate-rise flex flex-1 flex-col gap-4 rounded-xl border border-line bg-surface p-6";

/** "마감 임박": 진행 중(초안·리뷰) 중 D-day가 가장 가까운 것 */
export function UrgentCard({ r, now, reviewers }: { r: AppRow; now: Date; reviewers: { id: string; name: string | null; email: string | null }[] }) {
  const a = r.announcement;
  const t = timeline(a.applyStart, a.applyEnd, now);
  const reviewer = reviewers[0];
  return (
    <article className={card}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-urgent-text">마감 임박</span>
        <span className="flex h-7 items-center rounded-full px-3 text-[13px] font-bold text-urgent-text" style={{ background: "var(--status-review-bg)" }}>
          {ddayLabel(t)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[17px] leading-[1.45] font-bold">{a.title}</span>
        <span className="text-[13px] text-ink-3">{[a.organization, STATUS_STYLE[r.status].label].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        {reviewer ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={reviewer.name} email={reviewer.email} />
            <span className="truncate text-[13px] text-ink-2">{reviewer.name ?? reviewer.email}님이 리뷰하고 있어요</span>
          </div>
        ) : (
          <span className="text-[13px] text-ink-2">{r.status === "review" ? "리뷰어를 아직 정하지 않았어요" : "초안을 쓰고 있어요"}</span>
        )}
        <Link href={`/announcements/${a.id}`} className="flex-none text-[13px] font-semibold text-accent hover:text-accent-hover">
          열기
        </Link>
      </div>
    </article>
  );
}

/** "새로 맞는 공고": 지난 24시간 안에 들어온 새 공고 중 최고 점수 */
export function NewMatchCard({ r, now }: { r: AppRow; now: Date }) {
  const a = r.announcement;
  const t = timeline(a.applyStart, a.applyEnd, now);
  const when =
    t.phase === "upcoming" && a.applyStart
      ? `${String(kstYmd(a.applyStart).month).padStart(2, "0")}.${String(kstYmd(a.applyStart).day).padStart(2, "0")} 접수 시작`
      : ddayLabel(t);
  return (
    <article className={card}>
      <span className="text-[14px] font-semibold text-ink-2">새로 맞는 공고</span>
      <div className="flex flex-col gap-1">
        <Link href={`/announcements/${a.id}`} className="text-[17px] leading-[1.45] font-bold hover:underline hover:underline-offset-4">
          {a.title}
        </Link>
        <span className="text-[13px] text-ink-3">{[a.organization, when].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-2">
          적합도 <b className="text-accent">{r.match.score}</b>
        </span>
        <StatusButton
          applicationId={r.id}
          to="drafting"
          label="초안 만들기"
          pendingLabel="시작하는 중"
          redirectTo={`/announcements/${a.id}`}
          className={buttonClass("soft", "sm", "h-9 text-[13px]")}
        />
      </div>
    </article>
  );
}
