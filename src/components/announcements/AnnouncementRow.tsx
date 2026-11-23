import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TimelineBar } from "@/components/ui/TimelineBar";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { StatusChip } from "@/components/ui/StatusChip";
import { timeline } from "@/lib/dday";
import { STATUS_STYLE } from "@/lib/status";
import { SOURCE_LABEL } from "@/lib/sources";
import type { AppRow } from "@/server/matches";

export function rowMeta(r: AppRow) {
  const a = r.announcement;
  if (r.status === "excluded") return r.excludedReason ?? r.match.excludeReason ?? "제외됨";
  const parts = [
    r.status === "new" && r.match.eligibility === "ineligible" ? "제외 후보 (자격 미달 가능성)" : null,
    a.organization,
    a.executingOrg !== a.organization ? a.executingOrg : null,
    a.supportAmountText,
    a.regionLimit ? `${a.regionLimit} 한정` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "기관 정보 없음";
}

/**
 * 리스트 행 (DESIGN.md AnnouncementRow): 점수 배지 / 공고명+메타 / 타임라인 / 상태 칩 / chevron.
 * 모바일은 배지+제목 한 줄(칩은 제목 옆), 아래에 타임라인 전체 폭
 */
export function AnnouncementRow({ r, now }: { r: AppRow; now: Date }) {
  const a = r.announcement;
  const t = timeline(a.applyStart, a.applyEnd, now);
  const dimmed = STATUS_STYLE[r.status].dimmed;
  const alsoIn = a._count.duplicates;
  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/announcements/${a.id}`}
        className="group flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-5 transition-colors duration-[120ms] hover:bg-row-hover md:px-6"
        style={dimmed ? { opacity: 0.55 } : undefined}
      >
        <ScoreBadge score={r.match.score} status={r.status === "excluded" ? null : r.match.scoreStatus} />
        <div className="flex min-w-0 flex-1 basis-[180px] flex-col gap-1 md:basis-[260px] md:flex-[3]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[16px] leading-[1.45] font-bold">{a.title}</span>
            <StatusChip status={r.status} className="flex-none md:hidden" />
          </div>
          <span className="text-[13px] leading-[1.5] text-ink-3">
            {rowMeta(r)}
            <span> · {SOURCE_LABEL[a.source]}{alsoIn ? ` 외 ${alsoIn}곳` : ""}</span>
          </span>
        </div>
        <div className="w-full md:w-auto md:min-w-[200px] md:flex-[2]">
          <TimelineBar t={t} start={a.applyStart} end={a.applyEnd} muted={dimmed} />
        </div>
        <span className="hidden w-24 flex-none justify-end md:flex">
          <StatusChip status={r.status} />
        </span>
        <ChevronRight
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className="hidden flex-none text-ink-disabled transition-colors group-hover:text-ink-2 md:block"
        />
      </Link>
    </li>
  );
}
