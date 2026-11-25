import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle, ChevronRight, Database, ExternalLink, Globe, LoaderCircle, Newspaper } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { AddBoardForm } from "@/components/sources/AddBoardForm";
import { AddNewsletterForm } from "@/components/sources/AddNewsletterForm";
import { BoardActions } from "@/components/sources/BoardActions";
import { SyncAllButton } from "@/components/sources/SyncAllButton";
import { DraftPoller } from "@/components/draft/DraftPoller";
import { requireUser } from "@/server/session";
import { getSourceList, type ApiSourceRow, type BoardSourceRow, type NewsletterIssueRow } from "@/server/sourceList";
import { llmConfigured } from "@/server/llm";
import { SOURCE_LABEL } from "@/lib/sources";
import { formatKstRelative } from "@/lib/format";
import { KeyButton, type KeyView } from "@/components/settings/KeyButton";
import { keyViews } from "@/server/keyViews";

export default function Page() {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Sources />
    </Suspense>
  );
}

const API_KEY_NAME = { bizinfo: "BIZINFO_API_KEY", kstartup: "DATA_GO_KR_SERVICE_KEY" } as const;

async function Sources() {
  await connection();
  await requireUser();
  const now = new Date();
  const [{ api, board, newsletter, newsletterCount }, keys] = await Promise.all([getSourceList(now), keyViews()]);
  const llm = llmConfigured();

  return (
    <>
      <PageHeader eyebrow="매일 아침 8시에 새 공고를 확인해요" title={`공고 소스 ${api.length + board.length}곳`} actions={<SyncAllButton />} />
      <DraftPoller active={board.some((b) => b.checking)} everyMs={4000} />

      <AddBoardForm />
      {!llm ? (
        <div role="note" className="-mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] text-urgent-text">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
            게시판 글을 읽으려면 Anthropic API 키가 필요해요. 연결은 먼저 해 둘 수 있어요.
          </span>
          <KeyButton k={keys.views.ANTHROPIC_API_KEY} />
        </div>
      ) : null}

      <section aria-labelledby="sources-list" className="flex flex-col gap-3">
        <h2 id="sources-list" className="m-0 text-[20px] leading-[1.4] font-bold">
          연결된 소스
        </h2>
        <ul className="m-0 list-none overflow-hidden rounded-xl border border-line bg-surface p-0">
          {api.map((s) => (
            <ApiRow key={s.key} s={s} now={now} k={keys.views[API_KEY_NAME[s.key]]} />
          ))}
          {board.map((b) => (
            <BoardRow key={b.id} b={b} now={now} />
          ))}
        </ul>
        {board.length === 0 ? <p className="m-0 px-2 text-[13px] text-ink-3">아직 연결한 게시판이 없어요. 위에서 기관 공고 목록 주소를 넣어 주세요.</p> : null}
      </section>

      <AddNewsletterForm />
      <section aria-labelledby="newsletter-list" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="newsletter-list" className="m-0 text-[20px] leading-[1.4] font-bold">
            가져온 뉴스레터
          </h2>
          {newsletterCount ? <Count n={newsletterCount} source="newsletter" /> : null}
        </div>
        {newsletter.length ? (
          <ul className="m-0 list-none overflow-hidden rounded-xl border border-line bg-surface p-0">
            {newsletter.map((n) => (
              <IssueRow key={n.id} n={n} now={now} />
            ))}
          </ul>
        ) : (
          <p className="m-0 px-2 text-[13px] text-ink-3">아직 가져온 뉴스레터가 없어요.</p>
        )}
      </section>
    </>
  );
}

function Row({ icon, title, chip, sub, status, right }: { icon: React.ReactNode; title: string; chip: string; sub: React.ReactNode; status: React.ReactNode; right: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 md:flex-row md:items-center md:gap-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-lg bg-surface-subtle text-ink-2">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{title}</span>
            <span className="flex h-6 items-center rounded-full bg-chip px-2.5 text-[12px] font-semibold text-ink-2">{chip}</span>
          </div>
          <span className="min-w-0 text-[13px] text-ink-3">{sub}</span>
          <span className="text-[13px]">{status}</span>
        </div>
      </div>
      <div className="flex flex-none items-center justify-between gap-4 pl-14 md:justify-end md:pl-0">{right}</div>
    </li>
  );
}

function Count({ n, source }: { n: number; source: string }) {
  return (
    <Link href={`/announcements?source=${source}&closed=1`} className="text-[13px] font-semibold whitespace-nowrap text-ink-2 hover:text-ink">
      공고 {n.toLocaleString("ko-KR")}건
    </Link>
  );
}

const ErrorLine = ({ text }: { text: string }) => (
  <span className="flex items-start gap-1.5 text-urgent-text">
    <AlertCircle size={14} strokeWidth={2} aria-hidden="true" className="mt-[3px] flex-none" />
    {text}
  </span>
);

function ApiRow({ s, now, k }: { s: ApiSourceRow; now: Date; k: KeyView }) {
  const status = !s.connected ? (
    <span className="text-ink-3">{k.broken ? "저장된 키를 읽지 못했어요. 다시 넣어 주세요" : "API 키를 넣으면 매일 가져와요"}</span>
  ) : s.lastError ? (
    <ErrorLine text={`${s.lastAt ? `${formatKstRelative(s.lastAt, now)} ` : ""}불러오기 실패 · ${s.lastError}`} />
  ) : s.lastAt ? (
    <span className="text-ink-2">
      {formatKstRelative(s.lastAt, now)} 가져옴 · 새 공고 {s.lastCreated ?? 0}건
    </span>
  ) : (
    <span className="text-ink-3">아직 가져온 적이 없어요</span>
  );
  return (
    <Row
      icon={<Database size={18} strokeWidth={2} />}
      title={SOURCE_LABEL[s.key]}
      chip="기본"
      sub="공공데이터 API · 매일 자동"
      status={status}
      right={
        <>
          <Count n={s.count} source={s.key} />
          {s.connected ? (
            <span className="flex h-7 items-center rounded-full bg-[var(--status-submitted-bg)] px-3 text-[12px] font-semibold whitespace-nowrap text-[var(--status-submitted-fg)]">
              키 ••••{k.last4}
            </span>
          ) : null}
          <KeyButton k={k} />
        </>
      }
    />
  );
}

function BoardRow({ b, now }: { b: BoardSourceRow; now: Date }) {
  const status = b.checking ? (
    <span className="flex items-center gap-1.5 text-accent">
      <LoaderCircle size={14} strokeWidth={2.2} aria-hidden="true" className="animate-spin" />
      새 공고를 찾는 중이에요
    </span>
  ) : b.lastError ? (
    <ErrorLine text={`${b.lastAt ? `${formatKstRelative(b.lastAt, now)} ` : ""}확인 실패 · ${b.lastError}`} />
  ) : b.lastAt ? (
    <span className="text-ink-2">
      {formatKstRelative(b.lastAt, now)} 확인 · {b.lastNote}
    </span>
  ) : (
    <span className="text-ink-3">아직 확인 전이에요</span>
  );
  return (
    <Row
      icon={<Globe size={18} strokeWidth={2} />}
      title={b.name}
      chip={b.enabled ? "게시판" : "게시판 · 꺼짐"}
      sub={
        <a href={b.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 hover:text-ink-2">
          <span className="truncate">{b.host}</span>
          <ExternalLink size={12} strokeWidth={2} aria-hidden="true" className="flex-none" />
          <span className="sr-only">(새 창)</span>
        </a>
      }
      status={status}
      right={
        <>
          <Count n={b.count} source="board" />
          <BoardActions id={b.id} name={b.name} enabled={b.enabled} checking={b.checking} />
        </>
      }
    />
  );
}

function IssueRow({ n, now }: { n: NewsletterIssueRow; now: Date }) {
  const c = n.counts;
  const parts = [c.grant && `지원사업 ${c.grant}`, c.event && `행사 ${c.event}`, c.news && `뉴스 ${c.news}`, c.investment && `투자 ${c.investment}`].filter(Boolean).join(" · ");
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/announcements/sources/newsletters/${n.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-subtle md:px-6">
        <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-lg bg-surface-subtle text-ink-2">
          <Newspaper size={18} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[15px] font-semibold text-ink">{n.title}</span>
          <span className="text-[13px] text-ink-3">{parts}</span>
          <span className="text-[13px] text-ink-2">
            {formatKstRelative(n.fetchedAt, now)} 가져옴 · 새로 {c.created}건{c.existing ? ` · 이미 있음 ${c.existing}건` : ""}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2} aria-hidden="true" className="flex-none text-ink-3" />
      </Link>
    </li>
  );
}
