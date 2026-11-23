import { Suspense } from "react";
import { connection } from "next/server";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { SyncButton } from "@/components/announcements/SyncButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatKstHeaderDate } from "@/lib/kst";
import { requireUser } from "@/server/session";

export default function HomePage() {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  await requireUser();

  // M2에서 실제 집계로 바뀐다 (ARCHITECTURE.md 5.3)
  const todayNewCount = 0;
  const focusCount = 0;

  return (
    <>
      <PageHeader
        eyebrow={`${formatKstHeaderDate(new Date())} · 오늘 새 공고 ${todayNewCount}건`}
        title={focusCount > 0 ? `이번 주에 챙길 공고가 ${focusCount}개 있어요` : "이번 주에 챙길 공고가 아직 없어요"}
        actions={
          <>
            <form action="/announcements" className="w-full md:w-auto">
              <SearchInput />
            </form>
            <SyncButton />
          </>
        }
      />
      <EmptyState
        title="이번 주에 새로 맞는 공고가 없어요"
        description="공고를 가져오면 우리 회사에 잘 맞는 순서로 여기에 모아 드려요."
      />
    </>
  );
}
