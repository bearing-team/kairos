import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { ItemCardForm } from "@/components/company/ItemCardForm";
import { deleteItemCard } from "@/app/(app)/company/actions";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export default function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const item = await prisma.itemCard.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <>
      <PageHeader
        eyebrow="회사 프로필 · 아이템 카드"
        title={item.name}
        actions={
          <form action={deleteItemCard.bind(null, item.id)}>
            <button type="submit" className="h-11 px-4 text-[14px] font-semibold text-ink-3 hover:text-urgent-text">
              아이템 삭제하기
            </button>
          </form>
        }
      />
      <ItemCardForm
        id={item.id}
        values={{
          name: item.name,
          problem: item.problem ?? "",
          solution: item.solution ?? "",
          customer: item.customer ?? "",
          differentiation: item.differentiation ?? "",
          traction: item.traction ?? "",
          links: item.links.join("\n"),
        }}
      />
    </>
  );
}
