"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveItemCard, type FormState } from "@/app/(app)/company/actions";
import { Field, FormMessage, TextArea, TextInput } from "@/components/form/fields";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";

export type ItemCardValues = {
  name: string;
  problem: string;
  solution: string;
  customer: string;
  differentiation: string;
  traction: string;
  links: string;
};

export function ItemCardForm({ id, values }: { id: string | null; values: ItemCardValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveItemCard.bind(null, id), null);
  const e = state?.errors ?? {};
  return (
    <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="아이템 이름" name="name" error={e.name} wide>
          <TextInput name="name" defaultValue={values.name} required invalid={!!e.name} />
        </Field>
        <Field label="문제" name="problem" help="고객이 겪는 문제" error={e.problem}>
          <TextArea name="problem" defaultValue={values.problem} />
        </Field>
        <Field label="해결" name="solution" help="우리 제품이 푸는 방식" error={e.solution}>
          <TextArea name="solution" defaultValue={values.solution} />
        </Field>
        <Field label="고객" name="customer" help="누가 쓰고 누가 돈을 내는지" error={e.customer}>
          <TextArea name="customer" defaultValue={values.customer} />
        </Field>
        <Field label="차별점" name="differentiation" error={e.differentiation}>
          <TextArea name="differentiation" defaultValue={values.differentiation} />
        </Field>
        <Field
          label="성과"
          name="traction"
          help="사용자 수, 매출, 계약 등 확인된 숫자만 적어 주세요. 초안은 여기 없는 숫자를 지어내지 않아요"
          error={e.traction}
          wide
        >
          <TextArea name="traction" defaultValue={values.traction} />
        </Field>
        <Field label="링크" name="links" help="한 줄에 하나 (서비스, 소개 자료 등)" error={e.links} wide>
          <TextArea name="links" defaultValue={values.links} rows={3} invalid={!!e.links} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full md:w-auto")}>
          {pending ? "저장하는 중" : "아이템 저장하기"}
        </button>
        <Link href="/company?tab=items" className="px-2 text-[14px] font-semibold text-ink-2 hover:text-ink">
          취소
        </Link>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
