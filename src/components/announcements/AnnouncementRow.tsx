import { ExternalLink } from "lucide-react";
import { TimelineBar } from "@/components/ui/TimelineBar";
import { timeline } from "@/lib/dday";

export type RowData = {
  id: string;
  sourceLabel: string;
  title: string;
  organization: string | null;
  executingOrg: string | null;
  supportAmountText: string | null;
  regionLimit: string | null;
  applyStart: Date | null;
  applyEnd: Date | null;
  url: string | null;
  alsoIn: number;
};

/**
 * 리스트 행 (DESIGN.md AnnouncementRow). 점수 배지·상태 칩·상세 링크는 M2에서 붙는다.
 * 지금은 원문 공고로 연결한다
 */
export function AnnouncementRow({ a, now }: { a: RowData; now: Date }) {
  const t = timeline(a.applyStart, a.applyEnd, now);
  const meta = [a.organization, a.executingOrg !== a.organization ? a.executingOrg : null, a.supportAmountText, a.regionLimit ? `${a.regionLimit} 한정` : null]
    .filter(Boolean)
    .join(" · ");
  const Wrapper = a.url ? "a" : "div";
  return (
    <li className="border-b border-line last:border-b-0">
      <Wrapper
        {...(a.url ? { href: a.url, target: "_blank", rel: "noreferrer" } : {})}
        className="group flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 transition-colors duration-[120ms] hover:bg-row-hover md:px-6"
      >
        <div className="flex min-w-[260px] flex-[3] flex-col gap-1">
          <span className="text-[16px] leading-[1.45] font-bold">{a.title}</span>
          <span className="text-[13px] leading-[1.5] text-ink-3">
            {meta || "기관 정보 없음"}
            <span className="text-ink-3"> · {a.sourceLabel}{a.alsoIn ? ` 외 ${a.alsoIn}곳` : ""}</span>
          </span>
        </div>
        <div className="min-w-[200px] flex-[2]">
          <TimelineBar t={t} start={a.applyStart} end={a.applyEnd} />
        </div>
        {a.url ? (
          <ExternalLink
            size={18}
            strokeWidth={2}
            aria-label="원문 공고 열기"
            className="hidden flex-none text-ink-disabled transition-colors group-hover:text-ink-2 md:block"
          />
        ) : (
          <span className="hidden w-[18px] md:block" />
        )}
      </Wrapper>
    </li>
  );
}
