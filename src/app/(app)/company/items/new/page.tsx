import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ItemCardForm } from "@/components/company/ItemCardForm";
import { requireUser } from "@/server/session";

export default function NewItemPage() {
  return (
    <>
      <PageHeader eyebrow="회사 프로필 · 아이템 카드" title="아이템 추가" />
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  await requireUser();
  return (
    <ItemCardForm
      id={null}
      values={{ name: "", problem: "", solution: "", customer: "", differentiation: "", traction: "", links: "" }}
    />
  );
}
