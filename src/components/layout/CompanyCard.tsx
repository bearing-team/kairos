import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/server/db";
import { formatYearsInBusiness } from "@/lib/kst";

/** 사이드바 아래 회사 카드. "SW 스타트업 · 부산 · 업력 1년 미만"은 프로필에서 계산 */
export async function CompanyCard() {
  await connection();
  const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });

  if (!company) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-surface-subtle p-4">
        <span className="text-[14px] font-bold">회사 정보가 없어요</span>
        <Link href="/company" className="text-[12px] font-semibold text-accent hover:text-accent-hover">
          프로필 만들기
        </Link>
      </div>
    );
  }

  const summary = [
    company.industryLabel,
    company.region,
    company.foundedAt ? formatYearsInBusiness(company.foundedAt, new Date()) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-subtle p-4">
      <span className="text-[14px] font-bold">{company.name}</span>
      {summary ? <span className="text-[12px] leading-[1.6] text-ink-3">{summary}</span> : null}
      <Link href="/company" className="text-[12px] font-semibold text-accent hover:text-accent-hover">
        프로필 수정하기
      </Link>
    </div>
  );
}

export function CompanyCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-subtle p-4" aria-hidden="true">
      <span className="h-5 w-24 animate-pulse rounded-full bg-track" />
      <span className="h-4 w-40 animate-pulse rounded-full bg-track" />
    </div>
  );
}
