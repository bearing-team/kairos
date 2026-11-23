import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddFromUrl } from "@/components/announcements/AddFromUrl";
import { requireUser } from "@/server/session";

export default function NewAnnouncementPage() {
  return (
    <>
      <PageHeader eyebrow="전체 공고" title="주소로 공고 추가" />
      <Suspense fallback={null}>
        <Guarded />
      </Suspense>
    </>
  );
}

async function Guarded() {
  await requireUser();
  return <AddFromUrl />;
}
