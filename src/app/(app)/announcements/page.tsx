import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnnouncementRow } from "@/components/announcements/AnnouncementRow";
import { SourcesButton } from "@/components/announcements/SourcesButton";
import { LIST_STATUS, listAnnouncements, syncStatus, type ListStatus } from "@/server/announcements";
import { SOURCE_LABEL } from "@/server/sources/sync";
import { formatKstRelative } from "@/lib/format";
import { requireUser } from "@/server/session";
import type { AnnouncementSource } from "@/generated/prisma/client";

type SP = { q?: string; source?: string; status?: string; sort?: string; closed?: string; page?: string };
const SOURCES: AnnouncementSource[] = ["bizinfo", "kstartup", "board", "manual"];
const STATUS_TABS: [ListStatus, string][] = [["new", "새 공고"], ["progress", "진행 중"], ["done", "제출·결과"], ["excluded", "제외"]];
const SORTS: ["score" | "deadline" | "recent", string][] = [["score", "적합도순"], ["deadline", "마감 임박순"], ["recent", "최근 등록순"]];

export default function AnnouncementsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

function href(sp: SP, patch: Partial<SP>) {
  const next = { ...sp, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
  const s = qs.toString();
  return s ? `/announcements?${s}` : "/announcements";
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await connection();
  await requireUser();
  const sp = await searchParams;
  const source = SOURCES.includes(sp.source as AnnouncementSource) ? (sp.source as AnnouncementSource) : undefined;
  const sort = sp.sort === "recent" || sp.sort === "deadline" ? sp.sort : "score";
  const status = sp.status && sp.status in LIST_STATUS ? (sp.status as ListStatus) : undefined;
  const includeClosed = sp.closed === "1";
  const now = new Date();

  const [{ items, total, counts, all, page, pages }, sync] = await Promise.all([
    listAnnouncements({ q: sp.q, source, status, sort, includeClosed, page: Number(sp.page) || 1 }, now),
    syncStatus(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={sync.lastSuccessAt ? `${formatKstRelative(sync.lastSuccessAt, now)}에 가져왔어요` : "아직 공고를 가져온 적이 없어요"}
        title={`공고 ${all.toLocaleString("ko-KR")}건`}
        actions={
          <>
            <form action="/announcements" className="w-full md:w-auto">
              {source ? <input type="hidden" name="source" value={source} /> : null}
              {status ? <input type="hidden" name="status" value={status} /> : null}
              {sort !== "score" ? <input type="hidden" name="sort" value={sort} /> : null}
              <SearchInput defaultValue={sp.q} />
            </form>
            <SourcesButton />
          </>
        }
      />

      {sync.failing.length ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] text-urgent-text">
          <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
          {sync.failing.map((s) => SOURCE_LABEL[s]).join(", ")} 불러오기에 실패했어요 · 새 공고 가져오기에서 다시 시도할 수 있어요
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LinkTabs
          label="소스"
          current={source ?? "all"}
          items={[
            { key: "all", label: `전체 ${all}`, href: href(sp, { source: undefined, page: undefined }) },
            ...SOURCES.map((s) => ({ key: s, label: `${SOURCE_LABEL[s]} ${counts[s] ?? 0}`, href: href(sp, { source: s, page: undefined }) })),
          ]}
        />
        <LinkTabs
          label="상태"
          current={status ?? "all"}
          items={[
            { key: "all", label: "모든 상태", href: href(sp, { status: undefined, page: undefined }) },
            ...STATUS_TABS.map(([k, label]) => ({ key: k, label, href: href(sp, { status: k, page: undefined }) })),
          ]}
        />
      </div>

      <div className="-mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] font-semibold">
        <nav aria-label="정렬" className="flex items-center gap-3">
          {SORTS.map(([k, label]) => (
            <Link
              key={k}
              href={href(sp, { sort: k === "score" ? undefined : k, page: undefined })}
              aria-current={sort === k ? "true" : undefined}
              className={sort === k ? "text-ink" : "text-ink-3 hover:text-ink-2"}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href={href(sp, { closed: includeClosed ? undefined : "1", page: undefined })} className="text-accent hover:text-accent-hover">
            {includeClosed ? "마감 공고 숨기기" : "마감 공고도 보기"}
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        sp.q ? (
          <EmptyState title={`"${sp.q}"에 맞는 공고가 없어요`} description="다른 단어로 찾아보거나 필터를 바꿔 보세요." />
        ) : (
          <EmptyState
            title="아직 가져온 공고가 없어요"
            description="새 공고 가져오기에서 기업마당·K-Startup을 가져오거나 기관 게시판을 연결해 주세요."
          />
        )
      ) : (
        <section aria-label="공고 목록" className="overflow-hidden rounded-xl border border-line bg-surface">
          <ul className="m-0 list-none p-0">
            {items.map((a) => (
              <AnnouncementRow key={a.id} now={now} r={a} />
            ))}
          </ul>
        </section>
      )}

      {pages > 1 ? (
        <nav aria-label="페이지" className="flex items-center justify-center gap-4 text-[14px] font-semibold">
          {page > 1 ? <Link href={href(sp, { page: String(page - 1) })} className="text-accent">이전</Link> : null}
          <span className="text-ink-3">
            {page} / {pages} · {total}건
          </span>
          {page < pages ? <Link href={href(sp, { page: String(page + 1) })} className="text-accent">다음</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
