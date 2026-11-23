import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AlertCircle, ArrowLeft, Check, ExternalLink, FileText, Paperclip } from "lucide-react";
import { PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { TimelineBar } from "@/components/ui/TimelineBar";
import { buttonClass } from "@/components/ui/Button";
import { StatusButton } from "@/components/announcements/StatusButton";
import { ScoreRing } from "@/components/detail/ScoreRing";
import { ExcludeDialog } from "@/components/detail/ExcludeDialog";
import { RescoreButton } from "@/components/detail/RescoreButton";
import { MarkSeen } from "@/components/detail/MarkSeen";
import { timeline } from "@/lib/dday";
import { SOURCE_LABEL } from "@/lib/sources";
import { STATUS_STYLE } from "@/lib/status";
import { allowedNext, PRIMARY_ACTION } from "@/lib/transitions";
import { formatKstRelative } from "@/lib/format";
import { requireUser } from "@/server/session";
import { getAnnouncementDetail } from "@/server/matches";
import { llmConfigured } from "@/server/llm";
import { draftProgress } from "@/server/drafts";
import { prisma } from "@/server/db";
import { RequiredDocs } from "@/components/draft/RequiredDocs";

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

const ELIGIBILITY_LABEL = { eligible: "자격 충족", uncertain: "자격 확인 필요", ineligible: "자격 미달 가능성" } as const;
const ATTACHMENT_KIND = { notice: "공고문", form: "양식", other: "첨부" } as const;

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireUser();
  const { id } = await params;
  const d = await getAnnouncementDetail(id);
  if (!d) notFound();
  const { a, match, application: app, suggestedCard } = d;
  if (a.duplicateOf) redirect(`/announcements/${a.duplicateOf.id}`); // 중복이면 대표 공고로

  const now = new Date();
  const [progress, docs] = app
    ? await Promise.all([draftProgress([app.id]).then((m) => m.get(app.id) ?? null), prisma.requiredDoc.findMany({ where: { applicationId: app.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] })])
    : [null, []];
  const t = timeline(a.applyStart, a.applyEnd, now);
  const reasons = Array.isArray(match?.reasons) ? (match.reasons as string[]) : [];
  const risks = [...(Array.isArray(match?.risks) ? (match.risks as string[]) : []), ...(match?.filterNotes ?? [])];
  const facts: [string, ReactNode][] = (
    [
      ["주관 기관", a.organization],
      ["수행 기관", a.executingOrg !== a.organization ? a.executingOrg : null],
      ["지원 대상", a.target],
      ["지원 규모", a.supportAmountText],
      ["접수 기간", a.applyPeriodText],
      ["지역", a.regionLimit ? `${a.regionLimit} 한정` : null],
      ["분야", a.category],
      ["해시태그", a.hashtags.length ? a.hashtags.map((h) => `#${h}`).join(" ") : null],
    ] as [string, ReactNode][]
  ).filter(([, v]) => v);

  return (
    <>
      {app?.status === "new" ? <MarkSeen applicationId={app.id} /> : null}

      <Link href="/announcements" className="-mb-4 inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        전체 공고
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        {/* 왼쪽: 공고 내용 */}
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
              {app ? <StatusChip status={app.status} /> : null}
              <span>
                {SOURCE_LABEL[a.source]}
                {a.duplicates.length ? ` 외 ${a.duplicates.map((x) => SOURCE_LABEL[x.source]).join(", ")}` : ""} · {formatKstRelative(a.firstSeenAt, now)}에 들어옴
              </span>
            </div>
            <h1 className="m-0 text-[26px] leading-[1.35] font-extrabold tracking-[-0.02em] md:text-[28px]">{a.title}</h1>
            <div className="max-w-[480px]">
              <TimelineBar t={t} start={a.applyStart} end={a.applyEnd} />
            </div>
          </header>

          <section aria-label="공고 정보" className="rounded-xl border border-line bg-surface p-6">
            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[112px_1fr]">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
                  <dd className="m-0 -mt-3 text-[14px] leading-[1.6] whitespace-pre-line sm:mt-0">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" className={buttonClass("soft", "sm")}>
                  원문 공고 <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
                </a>
              ) : null}
              {a.applyUrl && a.applyUrl !== a.url ? (
                <a href={a.applyUrl} target="_blank" rel="noreferrer" className={buttonClass("soft", "sm")}>
                  신청 페이지 <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
                </a>
              ) : null}
              {a.duplicates
                .filter((x) => x.url)
                .map((x) => (
                  <a key={x.id} href={x.url!} target="_blank" rel="noreferrer" className={buttonClass("soft", "sm")}>
                    {SOURCE_LABEL[x.source]}에서 보기 <ExternalLink size={14} strokeWidth={2.2} aria-hidden="true" />
                  </a>
                ))}
            </div>
          </section>

          {a.summary ? (
            <section aria-labelledby="summary" className="flex flex-col gap-3">
              <h2 id="summary" className="m-0 text-[20px] font-bold">
                사업 내용
              </h2>
              <div className="rounded-xl border border-line bg-surface p-6 text-[15px] leading-[1.75] whitespace-pre-line text-ink-2">{a.summary}</div>
            </section>
          ) : null}

          {a.attachments.length ? (
            <section aria-labelledby="files" className="flex flex-col gap-3">
              <h2 id="files" className="m-0 text-[20px] font-bold">
                첨부파일
              </h2>
              <ul className="m-0 list-none overflow-hidden rounded-xl border border-line bg-surface p-0">
                {a.attachments.map((f) => (
                  <li key={f.id} className="border-b border-line last:border-b-0">
                    <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-6 py-4 hover:bg-row-hover">
                      {f.kind === "form" ? (
                        <FileText size={18} strokeWidth={2} aria-hidden="true" className="flex-none text-accent" />
                      ) : (
                        <Paperclip size={18} strokeWidth={2} aria-hidden="true" className="flex-none text-ink-3" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{f.fileName}</span>
                      <span className="flex-none text-[12px] text-ink-3">{ATTACHMENT_KIND[f.kind]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* 오른쪽: 판단 패널 */}
        <aside aria-label="적합도와 진행" className="flex w-full flex-none flex-col gap-5 rounded-xl border border-line bg-surface p-6 xl:sticky xl:top-10 xl:w-[360px]">
          {match?.score !== null && match?.score !== undefined ? (
            <div className="flex items-center gap-5">
              <ScoreRing score={match.score} />
              <div className="flex flex-col gap-1">
                {match.eligibility ? <span className="text-[15px] font-bold">{ELIGIBILITY_LABEL[match.eligibility]}</span> : null}
                <span className="text-[12px] text-ink-3">{match.scoredAt ? `${formatKstRelative(match.scoredAt, now)}에 매김` : null}</span>
                {llmConfigured() ? <RescoreButton matchId={match.id} /> : null}
              </div>
            </div>
          ) : match && !match.hardFilterPassed ? null : (
            <div className="flex flex-col gap-2 rounded-lg bg-surface-subtle p-4">
              <span className="text-[14px] font-semibold">
                {match?.scoreStatus === "failed" ? "점수를 매기지 못했어요" : match?.scoreStatus === "running" ? "점수를 매기는 중이에요" : "아직 점수가 없어요"}
              </span>
              <span className="text-[13px] text-ink-3">
                {match?.scoreStatus === "failed" ? match.scoreError : llmConfigured() ? "곧 매겨요. 바로 보려면 아래를 눌러 주세요." : "ANTHROPIC_API_KEY를 넣으면 적합도와 근거를 매겨요."}
              </span>
              {match && llmConfigured() ? <RescoreButton matchId={match.id} label="지금 점수 매기기" /> : null}
            </div>
          )}

          {app?.status === "excluded" ? (
            <div className="flex flex-col gap-1 rounded-lg bg-[var(--status-excluded-bg)] p-4">
              <span className="text-[14px] font-semibold">{app.autoExcluded ? "규칙 검사에서 제외됐어요" : "제외한 공고예요"}</span>
              <span className="text-[13px] text-ink-2">{app.excludedReason}</span>
            </div>
          ) : null}

          {reasons.length ? (
            <section aria-labelledby="reasons" className="flex flex-col gap-3">
              <h2 id="reasons" className="m-0 text-[15px] font-bold">
                맞는 이유
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[14px] leading-[1.5]">
                    <Check size={16} strokeWidth={2.4} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {risks.length ? (
            <section aria-labelledby="risks" className="flex flex-col gap-3">
              <h2 id="risks" className="m-0 text-[15px] font-bold">
                확인 필요
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {risks.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[14px] leading-[1.5]">
                    <AlertCircle size={16} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 flex-none text-urgent" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {suggestedCard ? (
            <p className="m-0 text-[13px] text-ink-2">
              추천 아이템 카드{" "}
              <Link href={`/company/items/${suggestedCard.id}`} className="font-semibold text-accent hover:text-accent-hover">
                {suggestedCard.name}
              </Link>
            </p>
          ) : null}

          {app && (progress || docs.length) ? (
            <section aria-label="초안" className="flex flex-col gap-3 border-t border-line pt-5">
              {progress ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-bold">사업계획서 초안</span>
                  <span className="text-[13px] text-ink-2">
                    {progress.status === "preparing" ? "양식을 읽는 중이에요" : progress.status === "failed" ? "만들지 못했어요" : `${progress.done}/${progress.total} 섹션 완료`}
                    {progress.checks ? <span className="ml-2 rounded-full bg-check-bg px-2 py-0.5 text-[12px] font-semibold text-check-fg">확인 필요 {progress.checks}곳</span> : null}
                  </span>
                </div>
              ) : null}
              {progress ? (
                <Link href={`/applications/${app.id}/draft`} className={buttonClass(app.status === "drafting" ? "primary" : "soft", "md", "w-full")}>
                  {app.status === "drafting" ? "초안 이어 쓰기" : "초안 보기"}
                </Link>
              ) : null}
              {docs.length ? <RequiredDocs applicationId={app.id} docs={docs} /> : null}
            </section>
          ) : null}

          {app ? <Actions app={app} hasDraft={!!progress} /> : <p className="m-0 text-[13px] text-ink-3">아직 매칭 전이에요. 새 공고 가져오기를 누르면 규칙 검사를 해요.</p>}

          {app?.events.length ? (
            <section aria-labelledby="history" className="flex flex-col gap-2 border-t border-line pt-4">
              <h2 id="history" className="m-0 text-[13px] font-semibold text-ink-3">
                기록
              </h2>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12px] leading-[1.5] text-ink-3">
                {app.events.map((e) => (
                  <li key={e.id}>
                    {formatKstRelative(e.createdAt, now)} · {e.user?.name ?? e.user?.email ?? "규칙 검사"} · {e.from ? `${STATUS_STYLE[e.from].label} → ` : ""}
                    {STATUS_STYLE[e.to].label}
                    {e.reason ? ` (${e.reason})` : ""}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function Actions({ app, hasDraft }: { app: { id: string; status: keyof typeof STATUS_STYLE }; hasDraft: boolean }) {
  const primary = PRIMARY_ACTION[app.status];
  const next = allowedNext(app.status);
  const canExclude = next.includes("excluded");
  const others = next.filter((s) => s !== "excluded" && s !== primary?.to);

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      {app.status === "submitted" ? (
        <div className="flex gap-2">
          <StatusButton applicationId={app.id} to="result_pass" label="선정됐어요" className={buttonClass("primary", "md", "w-full")} formClassName="flex-1" />
          <StatusButton applicationId={app.id} to="result_fail" label="미선정" className={buttonClass("soft", "md", "w-full")} formClassName="flex-1" />
        </div>
      ) : primary ? (
        <StatusButton
          applicationId={app.id}
          to={primary.to}
          label={primary.label}
          pendingLabel={primary.to === "drafting" ? "시작하는 중" : "바꾸는 중"}
          redirectTo={primary.to === "drafting" ? `/applications/${app.id}/draft` : undefined}
          className={buttonClass(hasDraft && primary.to === "review" ? "soft" : "primary", "lg", "w-full")}
        />
      ) : null}
      {canExclude ? <ExcludeDialog applicationId={app.id} className={buttonClass("soft", "md", "w-full")} /> : null}
      {primary?.to === "drafting" ? (
        <p className="m-0 text-[12px] leading-[1.5] text-ink-3">초안 만들기를 누르면 첨부 양식을 내려받아 섹션별 초안을 써요. 프로필에 없는 숫자·실적은 【확인 필요】로 남겨요.</p>
      ) : null}
      {others.filter((s) => app.status !== "submitted" || !s.startsWith("result")).length ? (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-ink-2">다른 상태로 바꾸기</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {others
              .filter((s) => app.status !== "submitted" || !s.startsWith("result"))
              .map((s) => (
                <StatusButton key={s} applicationId={app.id} to={s} label={STATUS_STYLE[s].label} className="h-9 rounded-full bg-surface-subtle px-4 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken" />
              ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
