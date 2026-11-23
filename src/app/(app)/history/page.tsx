import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/server/session";

export default function Page() {
  return (
    <>
      <PageHeader title="지원 이력" />
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireUser();
  return <EmptyState title="아직 준비 중인 화면이에요" description="다음 단계에서 이 화면을 채울게요." />;
}
