import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { BoardView } from "@/components/board/BoardView";
import { requireUser } from "@/server/session";
import { BOARD_COLUMNS, getBoard } from "@/server/board";
import { formatKstHeaderDate, kstYmd } from "@/lib/kst";

export default function Page() {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  await connection();
  await requireUser();
  const now = new Date();
  const b = await getBoard(now);
  const until = b.headline ? kstYmd(b.headline.until) : null;
  const title = b.headline && until ? `${until.month}월 ${until.day}일까지\n제출할 공고 ${b.headline.count}건` : b.inProgress ? `진행 중인 공고 ${b.inProgress}건` : "진행 중인 공고가 없어요";

  return (
    <>
      {/* C안 모먼트: 상단 파스텔 그라데이션(이 화면에 하나), 아래로 바탕색에 녹아든다 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" style={{ background: "var(--gradient-board)" }}>
        <div className="absolute inset-x-0 bottom-0 h-[120px]" style={{ background: "linear-gradient(180deg, transparent 0%, var(--color-bg) 100%)" }} />
      </div>
      <header className="flex flex-wrap items-end justify-between gap-6 pt-2 md:pt-8">
        <div className="flex max-w-[720px] flex-col gap-3">
          <span className="text-[15px] font-semibold" style={{ color: "var(--board-date)" }}>
            {formatKstHeaderDate(now)}
          </span>
          <h1 className="m-0 text-[36px] leading-[1.2] font-extrabold tracking-[-0.04em] whitespace-pre-line md:text-[52px]">{title}</h1>
        </div>
        <dl className="m-0 flex flex-wrap gap-3">
          {(
            [
              ["이번 달 제출", b.submittedThisMonth, b.dueThisMonth > b.submittedThisMonth ? ` / ${b.dueThisMonth}건` : "건"],
              ["리뷰 대기", b.reviewWaiting, "건"],
            ] as const
          ).map(([k, v, unit]) => (
            <div key={k} className="flex min-w-[120px] flex-col gap-1 rounded-[20px] px-5 py-4 backdrop-blur-[20px]" style={{ background: "var(--glass-stat)" }}>
              <dt className="text-[13px] text-ink-2">{k}</dt>
              <dd className="m-0 text-[26px] font-extrabold">
                {v}
                <span className="text-[15px] font-semibold text-ink-2">{unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </header>
      <p className="sr-only">카드를 끌어서 다른 열에 놓거나, 카드의 옮기기 버튼으로 상태를 바꿀 수 있어요.</p>
      <BoardView columns={BOARD_COLUMNS} initial={b.columns} recommendedMore={b.recommendedMore} />
    </>
  );
}
