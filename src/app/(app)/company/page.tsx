import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { buttonClass } from "@/components/ui/Button";
import { CompanyForm } from "@/components/company/CompanyForm";
import { ExclusionRules } from "@/components/company/ExclusionRules";
import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { requireUser } from "@/server/session";

type Tab = "basic" | "items" | "rules";
const TABS: { key: Tab; label: string }[] = [
  { key: "basic", label: "기본 정보" },
  { key: "items", label: "아이템 카드" },
  { key: "rules", label: "제외 규칙" },
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
    </>
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
