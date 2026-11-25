import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { DeleteIssueButton } from "@/components/sources/DeleteIssueButton";
import { requireUser } from "@/server/session";
import { prisma } from "@/server/db";
import { countRows, type NewsletterRow } from "@/server/sources/newsletter";
import { formatKstRelative } from "@/lib/format";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Issue params={params} />
    </Suspense>
  );
}

const STATUS: Record<NewsletterRow["status"], { label: string; cls: string }> = {
  new: { label: "새로 추가", cls: "bg-accent-soft text-accent" },
  updated: { label: "저장됨", cls: "bg-chip text-ink-2" },
  existing: { label: "이미 있음", cls: "bg-chip text-ink-2" },
};

const dot = (ymd: string | null) => (ymd ? ymd.slice(5).replace("-", ".") : null);

async function Issue({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireUser();
  const { id } = await params;
  const issue = await prisma.newsletterIssue.findUnique({ where: { id } });
  if (!issue) notFound();
  const rows = issue.items as unknown as NewsletterRow[];
  const c = countRows(rows);
  const sections = [...new Set(rows.map((r) => r.section))];
  const now = new Date();

  return (
    <>
      <Link href="/announcements/sources" className="-mb-4 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
        공고 소스
      </Link>
      <PageHeader
        eyebrow={`${formatKstRelative(issue.fetchedAt, now)} 가져옴 · ${c.total}건 중 새로 ${c.created}건${c.existing ? ` · 이미 있음 ${c.existing}건` : ""}`}
        title={issue.title}
        actions={
          <div className="flex items-center gap-2">
            <a href={issue.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold text-ink-2 hover:bg-surface-subtle">
              원문 보기
              <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
              <span className="sr-only">(새 창)</span>
            </a>
            <DeleteIssueButton id={issue.id} />
          </div>
        }
      />
      <p className="-mt-4 m-0 text-[13px] leading-[1.6] text-ink-3">
        모든 줄을 전체 공고에 넣었어요. 지원사업·행사는 적합도 점수를 매기고, 뉴스·투자 소식은 목록에만 보여요. 날짜가 지난 항목은 전체 공고의 &ldquo;마감 공고도 보기&rdquo;에서 보여요.
      </p>

      {sections.map((sec) => {
        const list = rows.filter((r) => r.section === sec);
        return (
          <section key={sec} aria-labelledby={`sec-${list[0].n}`} className="flex flex-col gap-3">
            <h2 id={`sec-${list[0].n}`} className="m-0 text-[20px] leading-[1.4] font-bold">
              {sec} <span className="text-[15px] font-semibold text-ink-3">{list.length}</span>
            </h2>
            <ul className="m-0 list-none overflow-hidden rounded-xl border border-line bg-surface p-0">
              {list.map((r) => (
                <li key={r.n} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0 md:px-6">
                  <span className="w-12 flex-none text-[13px] font-semibold text-ink-2 tabular-nums">{dot(r.date) ?? "–"}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {r.announcementId ? (
                      <Link href={`/announcements/${r.announcementId}`} className="text-[15px] leading-[1.5] font-semibold text-ink hover:text-accent">
                        {r.title || r.text}
                      </Link>
                    ) : (
                      <span className="text-[15px] leading-[1.5] font-semibold text-ink">{r.title || r.text}</span>
                    )}
                    {r.organization || r.time || r.endDate ? (
                      <span className="text-[13px] text-ink-3">{[r.organization, r.endDate ? `~ ${dot(r.endDate)}` : null, r.time].filter(Boolean).join(" · ")}</span>
                    ) : null}
                  </span>
                  <span className={`hidden h-6 flex-none items-center rounded-full px-2.5 text-[12px] font-semibold md:flex ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noreferrer" aria-label={`${r.title} 원문 (새 창)`} className="flex size-9 flex-none items-center justify-center rounded-full text-ink-3 hover:bg-surface-subtle hover:text-ink">
                      <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="size-9 flex-none" />
                  )}
                  {r.announcementId ? <ChevronRight size={18} strokeWidth={2} aria-hidden="true" className="hidden flex-none text-ink-3 md:block" /> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
