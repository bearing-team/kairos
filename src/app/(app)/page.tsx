import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { SourcesButton } from "@/components/announcements/SourcesButton";
import { AnnouncementRow } from "@/components/announcements/AnnouncementRow";
import { FocusHeroCard } from "@/components/home/FocusHeroCard";
import { NewMatchCard, UrgentCard } from "@/components/home/SideCards";
import { formatKstHeaderDate } from "@/lib/kst";
import { requireUser } from "@/server/session";
import { getHomeData, HOME_TABS, scoreBacklog, type HomeTab } from "@/server/matches";
import { draftProgress } from "@/server/drafts";
import { llmConfigured } from "@/server/llm";

type SP = { tab?: string };

export default function HomePage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}

const TAB_LABEL: Record<HomeTab, string> = { all: "전체", new: "새 공고", progress: "진행 중", excluded: "제외" };

async function HomeContent({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  await requireUser();
  const sp = await searchParams;
  const tab: HomeTab = HOME_TABS.includes(sp.tab as HomeTab) ? (sp.tab as HomeTab) : "all";
  const now = new Date();
  const [d, backlog] = await Promise.all([getHomeData(tab, now), scoreBacklog(now)]);
  const heroProgress = d.hero ? ((await draftProgress([d.hero.id])).get(d.hero.id) ?? null) : null;
  const hasAny = d.tabCounts.all > 0;
  const hasSide = !!(d.urgent || d.fresh);

  return (
    <>
      <PageHeader
        eyebrow={`${formatKstHeaderDate(now)} · 오늘 새 공고 ${d.todayNew}건`}
        title={d.focusCount > 0 ? `이번 주에 챙길 공고가 ${d.focusCount}개 있어요` : "이번 주에 챙길 공고가 아직 없어요"}
        actions={
          <>
            <form action="/announcements" className="w-full md:w-auto">
              <SearchInput />
            </form>
            <SourcesButton />
          </>
        }
      />

      {backlog > 0 ? (
        <p role="status" className="m-0 flex items-center gap-2 rounded-lg bg-surface-subtle px-4 py-3 text-[13px] text-ink-2">
          <Info size={16} strokeWidth={2} aria-hidden="true" className="flex-none text-ink-3" />
          {llmConfigured()
            ? `적합도 점수를 매기는 중이에요 · 남은 ${backlog}건`
            : `ANTHROPIC_API_KEY가 없어 적합도 점수 없이 규칙 검사만 했어요 · 점수 대기 ${backlog}건`}
        </p>
      ) : null}

      {!hasAny ? (
        <EmptyState
          title="이번 주에 새로 맞는 공고가 없어요"
          description="공고를 가져오면 우리 회사에 잘 맞는 순서로 여기에 모아 드려요."
        />
      ) : (
        <>
          {d.hero || hasSide ? (
            <section aria-label="이번 주 포커스" className="flex flex-wrap gap-5">
              {d.hero ? <FocusHeroCard r={d.hero} now={now} progress={heroProgress} /> : null}
              {hasSide ? (
                <div className={`flex min-w-0 flex-col gap-5 ${d.hero ? "flex-[1_1_300px]" : "flex-1 md:flex-row"}`}>
                  {d.urgent ? <UrgentCard r={d.urgent} now={now} reviewers={d.reviewers} /> : null}
                  {d.fresh ? <NewMatchCard r={d.fresh} now={now} /> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="recommended" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="recommended" className="m-0 text-[20px] leading-[1.4] font-bold">
                추천 공고
              </h2>
              <LinkTabs
                label="상태 필터"
                current={tab}
                items={HOME_TABS.map((k) => ({ key: k, label: `${TAB_LABEL[k]} ${d.tabCounts[k]}`, href: k === "all" ? "/" : `/?tab=${k}` }))}
              />
            </div>
            {d.list.length ? (
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <ul className="m-0 list-none p-0">
                  {d.list.map((r) => (
                    <AnnouncementRow key={r.id} r={r} now={now} />
                  ))}
                </ul>
              </div>
            ) : (
              <p className="m-0 rounded-xl border border-line bg-surface px-6 py-10 text-center text-[14px] text-ink-3">
                {tab === "progress" ? "진행 중인 공고가 없어요. 마음에 드는 공고에서 초안 만들기를 눌러 보세요." : "해당하는 공고가 없어요."}
              </p>
            )}
            {d.tabCounts[tab] > d.list.length ? (
              <Link
                href={`/announcements${tab === "all" ? "" : `?status=${tab === "progress" ? "progress" : tab}`}`}
                className="self-center text-[14px] font-semibold text-accent hover:text-accent-hover"
              >
                전체 공고 보기
              </Link>
            ) : null}
          </section>
        </>
      )}
    </>
  );
}
