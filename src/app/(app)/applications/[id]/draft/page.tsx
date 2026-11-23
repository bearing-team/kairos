import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertCircle, ArrowLeft, Download, FileText, Info, Paperclip } from "lucide-react";
import { PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { buttonClass } from "@/components/ui/Button";
import { StatusButton } from "@/components/announcements/StatusButton";
import { SectionCard } from "@/components/draft/SectionCard";
import { RequiredDocs } from "@/components/draft/RequiredDocs";
import { DraftPoller } from "@/components/draft/DraftPoller";
import { GenerateMissingButton, StartDraftButton } from "@/components/draft/StartDraftButton";
import { formatKstRelative } from "@/lib/format";
import { requireUser } from "@/server/session";
import { getDraftPage } from "@/server/drafts";
import { llmConfigured } from "@/server/llm";
import { TEMPLATE_LABEL, type TemplateType } from "@/server/drafting/templates";

export default function DraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Draft params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const KIND = { notice: "공고문", form: "양식", other: "첨부" } as const;

async function Draft({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  await connection();
  await requireUser();
  const { id } = await params;
  const { v } = await searchParams;
  const data = await getDraftPage(id, v ? Number(v) || undefined : undefined);
  if (!data) notFound();
  const { app, draft } = data;
  const a = app.announcement;
  const llm = llmConfigured();
  const now = new Date();

  const sections = draft?.sections ?? [];
  const done = sections.filter((s) => s.status === "done").length;
  const checks = sections.reduce((n, s) => n + s.needsCheck.length, 0);
  const working = !!draft && (draft.status === "preparing" || draft.status === "generating" || sections.some((s) => s.status === "generating"));
  const missing = sections.filter((s) => s.status === "empty" || s.status === "failed").length;
  const source = draft?.templateSource?.startsWith("default:") ? `기본 템플릿(${TEMPLATE_LABEL[draft.templateSource.slice(8) as TemplateType] ?? "기본"})` : draft?.formAttachment ? `양식 ‘${draft.formAttachment.fileName}’` : null;

  return (
    <>
      <DraftPoller active={working} />
      <Link href={`/announcements/${a.id}`} className="-mb-4 inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        공고 상세
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            <StatusChip status={app.status} />
            {draft ? (
              <span>
                초안 v{draft.version} · {formatKstRelative(draft.createdAt, now)} 만듦{source ? ` · ${source}` : ""}
              </span>
            ) : null}
          </div>
          <h1 className="m-0 text-[26px] leading-[1.35] font-extrabold tracking-[-0.02em] md:text-[30px]">{a.title}</h1>
          {draft && sections.length ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-ink-2">
                {done}/{sections.length} 섹션 완료
              </span>
              {checks ? <span className="rounded-full bg-check-bg px-2.5 py-1 font-semibold text-check-fg">확인 필요 {checks}곳</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draft && !working ? <StartDraftButton applicationId={app.id} label="초안 새로 만들기" className={buttonClass("soft", "md")} /> : null}
          {app.status === "drafting" && draft ? <StatusButton applicationId={app.id} to="review" label="리뷰 요청하기" className={buttonClass("primary", "md")} /> : null}
        </div>
      </header>

      {!draft ? (
        <section className="flex flex-col items-start gap-4 rounded-xl border border-line bg-surface p-8">
          <h2 className="m-0 text-[20px] font-bold">아직 초안이 없어요</h2>
          <p className="m-0 max-w-[560px] text-[15px] leading-[1.7] text-ink-2">
            공고의 첨부 양식을 내려받아 읽고, 섹션마다 회사 프로필과 아이템 카드로 초안을 써요. 프로필에 없는 숫자·실적은 지어내지 않고 <mark className="rounded-[6px] bg-check-bg px-1 text-check-fg">【확인 필요】</mark>로 남겨요.
          </p>
          {!llm ? <p className="m-0 text-[13px] text-ink-3">ANTHROPIC_API_KEY가 없어 지금은 양식만 받고 기본 섹션을 만들어요.</p> : null}
          <StartDraftButton applicationId={app.id} label="초안 만들기" className={buttonClass("primary", "lg")} />
        </section>
      ) : (
        <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start min-[1400px]:grid-cols-[180px_minmax(0,1fr)_300px]">
          {/* 왼쪽: 섹션 목차 (넓은 화면만) */}
          {sections.length ? (
            <nav aria-label="섹션 목차" className="sticky top-10 hidden flex-col gap-1 min-[1400px]:flex">
              {sections.map((s) => (
                <a key={s.id} href={`#sec-${s.order}`} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] leading-[1.45] text-ink-2 hover:bg-surface-subtle">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 flex-none rounded-full ${s.status === "done" ? "bg-[var(--status-drafting-dot)]" : s.status === "failed" ? "bg-urgent" : s.status === "generating" ? "animate-pulse bg-[var(--status-drafting-dot)]" : "bg-track"}`}
                  />
                  <span className="min-w-0 flex-1">{s.title}</span>
                  {s.needsCheck.length ? <span className="flex-none rounded-full bg-check-bg px-1.5 text-[11px] font-semibold text-check-fg">{s.needsCheck.length}</span> : null}
                </a>
              ))}
            </nav>
          ) : (
            <span className="hidden min-[1400px]:block" />
          )}

          {/* 가운데: 섹션 */}
          <div className="flex min-w-0 flex-col gap-4">
            {draft.status === "preparing" ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-6" aria-live="polite">
                <span className="text-[15px] font-bold">첨부 양식을 받아 읽고 있어요</span>
                <span className="text-[13px] text-ink-3">양식에서 써야 할 섹션과 제출 서류를 찾는 중이에요. 1~2분 걸려요.</span>
                <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-track">
                  <span className="block h-full w-1/3 animate-pulse rounded-full bg-[var(--status-drafting-dot)]" />
                </span>
              </div>
            ) : null}
            {draft.status === "failed" ? (
              <p role="alert" className="m-0 flex items-start gap-2 rounded-xl border border-line bg-surface p-5 text-[14px] text-urgent-text">
                <AlertCircle size={18} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 flex-none" />
                초안을 만들지 못했어요. {draft.error ?? "중간에 멈췄어요."} 초안 새로 만들기로 다시 해 보세요.
              </p>
            ) : null}
            {draft.notes.length ? (
              <ul className="m-0 flex list-none flex-col gap-1.5 rounded-xl bg-surface-subtle p-4 text-[13px] leading-[1.6] text-ink-2">
                {draft.notes.map((n) => (
                  <li key={n} className="flex items-start gap-2">
                    <Info size={15} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 flex-none text-ink-3" />
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
            {llm && !working && missing && sections.length ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5">
                <span className="text-[14px] text-ink-2">비어 있는 섹션 {missing}개</span>
                <GenerateMissingButton draftId={draft.id} label="빈 섹션 초안 쓰기" className={buttonClass("soft", "sm")} />
              </div>
            ) : null}
            {sections.map((s) => (
              <SectionCard key={s.id} s={s} llm={llm} />
            ))}
          </div>

          {/* 오른쪽: 서류·첨부·평가 기준 */}
          <aside aria-label="제출 준비" className="flex w-full flex-col gap-6 rounded-xl border border-line bg-surface p-6 xl:sticky xl:top-10">
            <RequiredDocs applicationId={app.id} docs={app.requiredDocs} />

            {draft.criteria.length ? (
              <section aria-labelledby="criteria" className="flex flex-col gap-2 border-t border-line pt-5">
                <h2 id="criteria" className="m-0 text-[15px] font-bold">
                  평가 기준
                </h2>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-[1.6] text-ink-2">
                  {draft.criteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {a.attachments.length ? (
              <section aria-labelledby="files" className="flex flex-col gap-2 border-t border-line pt-5">
                <h2 id="files" className="m-0 text-[15px] font-bold">
                  첨부파일
                </h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {a.attachments.map((f) => {
                    const chars = (f.parsed as { chars?: number } | null)?.chars;
                    return (
                      <li key={f.id} className="flex items-start gap-2">
                        {f.kind === "form" ? (
                          <FileText size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
                        ) : (
                          <Paperclip size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 flex-none text-ink-3" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[13px] leading-[1.5] font-semibold break-all">{f.fileName}</span>
                          <span className="text-[12px] leading-[1.5] text-ink-3">
                            {KIND[f.kind]}
                            {f.parseStatus === "parsed" ? ` · 읽음${chars ? ` ${chars.toLocaleString("ko-KR")}자` : ""}` : f.parseStatus === "failed" ? ` · ${f.parseError ?? "읽지 못함"}` : ""}
                          </span>
                        </div>
                        {f.fileKey ? (
                          <a href={`/api/attachments/${f.id}`} aria-label={`${f.fileName} 내려받기`} className="flex-none rounded-full p-1 text-ink-3 hover:bg-surface-subtle hover:text-ink">
                            <Download size={16} strokeWidth={2} aria-hidden="true" />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {app.drafts.length > 1 ? (
              <section aria-labelledby="versions" className="flex flex-col gap-2 border-t border-line pt-5">
                <h2 id="versions" className="m-0 text-[15px] font-bold">
                  이전 버전
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {app.drafts.map((d) => (
                    <Link
                      key={d.id}
                      href={`/applications/${app.id}/draft?v=${d.version}`}
                      aria-current={d.version === draft.version ? "page" : undefined}
                      className={`h-8 rounded-full px-3 text-[13px] leading-8 font-semibold ${d.version === draft.version ? "bg-accent-soft text-accent" : "bg-surface-subtle text-ink-2 hover:bg-surface-sunken"}`}
                    >
                      v{d.version}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}
