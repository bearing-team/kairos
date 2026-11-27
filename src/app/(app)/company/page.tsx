import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { buttonClass } from "@/components/ui/Button";
import { CompanyForm } from "@/components/company/CompanyForm";
import { ExclusionRules } from "@/components/company/ExclusionRules";
import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { requireUser } from "@/server/session";
import { buildDeadlineAlerts, buildDigest, recentNotifications } from "@/server/notify/run";
import { slackConfigured, webhookUrl } from "@/server/notify/slack";
import { SendNowButton } from "@/components/company/NotifyPanel";
import { SlackPreview } from "@/components/company/SlackPreview";
import { formatKstRelative } from "@/lib/format";
import { KeyButton } from "@/components/settings/KeyButton";
import { KEY_INFO, keyViews } from "@/server/keyViews";
import { SECRET_NAMES } from "@/server/secrets";

type Tab = "basic" | "items" | "rules" | "notify" | "keys";
const TABS: { key: Tab; label: string }[] = [
  { key: "basic", label: "기본 정보" },
  { key: "items", label: "아이템 카드" },
  { key: "rules", label: "제외 규칙" },
  { key: "notify", label: "Slack 알림" },
  { key: "keys", label: "연결 키" },
];

export default function CompanyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <CompanyContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CompanyContent({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "basic";
  const company = await getCompany();

  return (
    <>
      <PageHeader
        eyebrow="매칭과 초안은 이 정보를 기준으로 만들어져요"
        title="회사 프로필"
        actions={
          tab === "items" ? (
            <Link href="/company/items/new" className={buttonClass("primary", "md", "w-full md:w-auto")}>
              <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
              아이템 추가하기
            </Link>
          ) : undefined
        }
      />
      <LinkTabs label="회사 프로필 탭" current={tab} items={TABS.map((t) => ({ ...t, href: `/company?tab=${t.key}` }))} />

      {tab === "basic" ? (
        <CompanyForm
          values={{
            name: company.name,
            industryLabel: company.industryLabel ?? "",
            foundedAt: company.foundedAt
              ? new Date(company.foundedAt.getTime() + 9 * 3600e3).toISOString().slice(0, 10)
              : "",
            region: company.region ?? "",
            bizType: company.bizType ?? "",
            ksicCodes: company.ksicCodes.join(", "),
            certifications: company.certifications.join(", "),
            headcount: company.headcount?.toString() ?? "",
            revenueBand: company.revenueBand ?? "",
            ceoBirthYear: company.ceoBirthYear?.toString() ?? "",
            description: company.description ?? "",
            address: company.address ?? "",
            ceoName: company.ceoName ?? "",
            contactName: company.contactName ?? "",
            contactDept: company.contactDept ?? "",
            contactTitle: company.contactTitle ?? "",
            contactPhone: company.contactPhone ?? "",
            contactTel: company.contactTel ?? "",
            contactEmail: company.contactEmail ?? "",
          }}
        />
      ) : null}

      {tab === "items" ? <ItemCards companyId={company.id} /> : null}

      {tab === "rules" ? (
        <ExclusionRules
          rules={await prisma.exclusionRule.findMany({
            where: { companyId: company.id },
            orderBy: { createdAt: "asc" },
            select: { id: true, kind: true, value: true, note: true },
          })}
        />
      ) : null}

      {tab === "notify" ? <NotifySettings /> : null}

      {tab === "keys" ? <KeySettings /> : null}
    </>
  );
}

async function NotifySettings() {
  const now = new Date();
  const [digest, deadline, log] = await Promise.all([buildDigest(now), buildDeadlineAlerts(now), recentNotifications(10)]);
  const w = webhookUrl();
  const configured = slackConfigured();
  const card = "flex flex-col gap-4 rounded-xl border border-line bg-surface p-6";
  return (
    <div className="flex flex-col gap-5">
      {!configured ? (
        <p role="status" className="m-0 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] text-urgent-text">
          {"error" in w ? w.error : ""} · Slack에서 Incoming Webhook을 만들고{" "}
          <Link href="/company?tab=keys" className="font-semibold underline underline-offset-2">
            연결 키
          </Link>
          에 주소를 넣어 주세요
        </p>
      ) : null}

      <section aria-labelledby="digest" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="digest" className="m-0 text-[17px] font-bold">
              주간 다이제스트
            </h2>
            <p className="m-0 text-[13px] text-ink-3">매주 월요일 오전 9시 · 이번 주에 챙길 공고(7일 안 마감 또는 적합도 85 이상)의 링크·공고명·마감일</p>
          </div>
          <SendNowButton kind="digest" label="지금 보내기" variant="primary" disabled={!configured} />
        </div>
        <SlackPreview text={digest.text} />
      </section>

      <section aria-labelledby="deadline" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="deadline" className="m-0 text-[17px] font-bold">
              마감 알림
            </h2>
            <p className="m-0 text-[13px] text-ink-3">매일 오전 9시 5분 · 초안 작성 중·리뷰 중인 공고의 마감 D-7, D-3, D-1 (구간마다 한 번)</p>
          </div>
          <SendNowButton kind="deadline" label="오늘 알림 보내기" variant="soft" disabled={!configured || deadline.due.length === 0} />
        </div>
        {deadline.due.length ? (
          <SlackPreview text={deadline.text} />
        ) : (
          <p className="m-0 rounded-lg bg-surface-subtle p-4 text-[14px] text-ink-3">오늘 보낼 마감 알림이 없어요.</p>
        )}
      </section>

      {log.length ? (
        <section aria-labelledby="sent-log" className={card}>
          <h2 id="sent-log" className="m-0 text-[17px] font-bold">
            보낸 기록
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
            {log.map((n) => (
              <li key={n.id} className="flex flex-wrap gap-x-2 text-ink-2">
                <span className="text-ink-3">{formatKstRelative(n.createdAt, now)}</span>
                <span>
                  {n.kind === "digest" ? "주간 다이제스트" : "마감 알림"} {n.itemCount}건{n.manual ? " (수동)" : ""}
                </span>
                <span className={n.ok ? "text-ink-3" : "text-urgent-text"}>{n.ok ? "보냄" : `실패 · ${n.error}`}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** 연결 키: .env가 먼저, 없으면 여기서 넣어 DB에 암호화 (src/server/secrets.ts) */
async function KeySettings() {
  const now = new Date();
  const { statuses, views } = await keyViews();
  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 list-none rounded-xl border border-line bg-surface p-0">
        {SECRET_NAMES.map((name) => {
          const s = statuses[name];
          const info = KEY_INFO[name];
          return (
            <li key={name} className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between md:px-6">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[15px] font-semibold text-ink">{info.label}</span>
                <span className="text-[13px] text-ink-3">{info.use}</span>
                <span className="text-[13px]">
                  {s.broken ? (
                    <span className="text-urgent-text">저장된 키를 읽지 못했어요 (AUTH_SECRET이 바뀜). 다시 넣어 주세요</span>
                  ) : s.source === "none" ? (
                    <span className="text-ink-3">
                      없음 ·{" "}
                      <a href={info.whereUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:text-accent-hover">
                        {info.where}
                        <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                        <span className="sr-only">(새 창)</span>
                      </a>
                      에서 받아요
                    </span>
                  ) : (
                    <span className="text-ink-2">
                      <span className="font-semibold tracking-[0.08em]">••••{s.last4}</span>
                      {s.source === "env" ? " · .env에서 읽어요" : s.updatedAt ? ` · ${formatKstRelative(s.updatedAt, now)} 저장` : ""}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-none justify-end">
                <KeyButton k={views[name]} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="m-0 px-2 text-[13px] leading-[1.6] text-ink-3">
        키는 저장하기 전에 실제로 한 번 확인하고, 서버 DB에 암호화해서 둬요. 화면에는 끝 4자리만 보여요. .env에 같은 키가 있으면 .env가 먼저예요.
      </p>
    </div>
  );
}

async function ItemCards({ companyId }: { companyId: string }) {
  const items = await prisma.itemCard.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
  if (items.length === 0) {
    return (
      <section className="flex flex-col items-start gap-4 rounded-xl border border-line bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[20px] leading-[1.4] font-bold">아이템 카드가 아직 없어요</h2>
          <p className="m-0 text-[14px] leading-[1.7] text-ink-3">
            제품별 문제·해결·고객·차별점을 적어 두면 공고 매칭과 초안에 그대로 쓰여요.
          </p>
        </div>
        <Link href="/company/items/new" className={buttonClass("soft", "sm")}>
          아이템 추가하기
        </Link>
      </section>
    );
  }
  const preview: { key: "problem" | "solution" | "customer" | "differentiation"; label: string }[] = [
    { key: "problem", label: "문제" },
    { key: "solution", label: "해결" },
    { key: "customer", label: "고객" },
    { key: "differentiation", label: "차별점" },
  ];
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {items.map((it) => (
        <Link
          key={it.id}
          href={`/company/items/${it.id}`}
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 transition-colors duration-[120ms] hover:bg-row-hover"
        >
          <h2 className="m-0 text-[17px] leading-[1.45] font-bold">{it.name}</h2>
          <dl className="m-0 grid grid-cols-[56px_1fr] gap-x-3 gap-y-2 text-[13px] leading-[1.6]">
            {preview.map((p) => (
              <div key={p.key} className="contents">
                <dt className="font-semibold text-ink-3">{p.label}</dt>
                <dd className="m-0 line-clamp-2 text-ink-2">{it[p.key] ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Link>
      ))}
    </div>
  );
}
