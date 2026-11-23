import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle, Plus } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnnouncementRow } from "@/components/announcements/AnnouncementRow";
import { SyncButton } from "@/components/announcements/SyncButton";
import { listAnnouncements, syncStatus } from "@/server/announcements";
import { SOURCE_LABEL } from "@/server/sources/sync";
import { formatKstRelative } from "@/lib/format";
import { requireUser } from "@/server/session";
import type { AnnouncementSource } from "@/generated/prisma/client";

type SP = { q?: string; source?: string; sort?: string; closed?: string; page?: string };
const SOURCES: AnnouncementSource[] = ["bizinfo", "kstartup", "manual"];

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
  const sort = sp.sort === "recent" ? "recent" : "deadline";
  const includeClosed = sp.closed === "1";
  const now = new Date();

  const [{ items, total, counts, all, page, pages }, status] = await Promise.all([
    listAnnouncements({ q: sp.q, source, sort, includeClosed, page: Number(sp.page) || 1 }, now),
    syncStatus(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={status.lastSuccessAt ? `${formatKstRelative(status.lastSuccessAt, now)}에 가져왔어요` : "아직 공고를 가져온 적이 없어요"}
        title={`공고 ${all.toLocaleString("ko-KR")}건`}
        actions={
          <>
            <form action="/announcements" className="w-full md:w-auto">
              {source ? <input type="hidden" name="source" value={source} /> : null}
              {sort === "recent" ? <input type="hidden" name="sort" value="recent" /> : null}
              <SearchInput defaultValue={sp.q} />
            </form>
            <Link href="/announcements/new" className={buttonClass("soft", "md", "w-full md:w-auto")}>
              <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
              주소로 추가
            </Link>
            <SyncButton />
          </>
        }
      />

      {status.failing.length ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] text-urgent-text">
          <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
          {status.failing.map((s) => SOURCE_LABEL[s]).join(", ")} 불러오기에 실패했어요 · 다시 시도하려면 새 공고 가져오기를 눌러 주세요
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
        <div className="flex items-center gap-4 text-[13px] font-semibold">
          <Link href={href(sp, { sort: sort === "recent" ? undefined : "recent", page: undefined })} className="text-ink-2 hover:text-ink">
            {sort === "recent" ? "최근 등록순" : "마감 임박순"}으로 보는 중 · 바꾸기
          </Link>
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
            description="새 공고 가져오기를 누르면 기업마당과 K-Startup에서 접수 중인 공고를 모아요. API 키는 .env에 넣어 주세요."
          />
        )
      ) : (
        <section aria-label="공고 목록" className="overflow-hidden rounded-xl border border-line bg-surface">
          <ul className="m-0 list-none p-0">
            {items.map((a) => (
              <AnnouncementRow
                key={a.id}
                now={now}
                a={{ ...a, sourceLabel: SOURCE_LABEL[a.source], alsoIn: a._count.duplicates }}
              />
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
