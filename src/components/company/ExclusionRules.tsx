"use client";

import { useActionState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { addExclusionRule, deleteExclusionRule, type FormState } from "@/app/(app)/company/actions";
import { Field, FormMessage, Select, TextInput } from "@/components/form/fields";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";
import { EXCLUSION_KIND_LABEL } from "@/lib/company";

type Rule = { id: string; kind: keyof typeof EXCLUSION_KIND_LABEL; value: string; note: string | null };

export function ExclusionRules({ rules }: { rules: Rule[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addExclusionRule, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const e = state?.errors ?? {};

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        {rules.length === 0 ? (
          <p className="m-0 px-6 py-6 text-[14px] text-ink-3">아직 제외 규칙이 없어요. 보고 싶지 않은 공고 유형을 아래에서 추가해 주세요.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center gap-4 border-b border-line px-6 py-4 last:border-b-0">
                <span className="flex h-7 flex-none items-center rounded-full bg-chip px-3 text-[12px] font-semibold text-ink-2">
                  {EXCLUSION_KIND_LABEL[r.kind].label}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{r.value}</span>
                  {r.note ? <span className="text-[13px] text-ink-3">{r.note}</span> : null}
                </div>
                <form action={deleteExclusionRule.bind(null, r.id)}>
                  <button
                    type="submit"
                    aria-label={`${r.value} 규칙 삭제`}
                    className="flex size-9 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-subtle hover:text-ink"
                  >
                    <X size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form ref={formRef} action={action} onSubmit={submitWith(action)} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 md:p-8">
        <h2 className="m-0 text-[17px] leading-[1.45] font-bold">규칙 추가</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr_1fr]">
          <Field label="종류" name="kind" error={e.kind}>
            <Select
              name="kind"
              placeholder="종류 선택"
              options={Object.entries(EXCLUSION_KIND_LABEL).map(([value, v]) => ({ value, label: v.label }))}
            />
          </Field>
          <Field label="값" name="value" help="예: 제조, 서울, 예비창업자" error={e.value}>
            <TextInput name="value" invalid={!!e.value} />
          </Field>
          <Field label="메모" name="note" help="왜 제외하는지 (선택)" error={e.note}>
            <TextInput name="note" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={buttonClass("soft", "md", "w-full md:w-auto")}>
            제외 규칙 추가하기
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </div>
  );
}
