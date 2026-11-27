"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Newspaper } from "lucide-react";
import { addNewsletter, type SourceState } from "@/app/(app)/announcements/sources/actions";
import { Field, FormMessage, TextInput } from "@/components/form/fields";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";

/** 뉴스레터 링크 붙여 넣기 → 안의 항목을 전부 공고로 */
export function AddNewsletterForm() {
  const [state, action, pending] = useActionState<(SourceState & { issueId?: string }) | null, FormData>(addNewsletter, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      if (state.issueId) router.push(`/announcements/sources/newsletters/${state.issueId}`);
    }
  }, [state, router]);
  const e = state?.errors ?? {};

  return (
    <form ref={formRef} action={action} onSubmit={submitWith(action)} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px] leading-[1.45] font-bold">뉴스레터 붙여 넣기</h2>
        <p className="m-0 text-[14px] leading-[1.6] text-ink-3">메일로 받은 뉴스레터 링크를 넣으면 안에 있는 지원사업·행사·소식을 읽어서 전체 공고에 넣어요. 지금은 피트페이퍼 링크를 읽을 수 있어요.</p>
      </div>
      <Field label="뉴스레터 링크" name="newsletterUrl" error={e.newsletterUrl} help="예: https://featpaper.com/…">
        <TextInput name="newsletterUrl" type="url" placeholder="https://featpaper.com/…" required invalid={!!e.newsletterUrl} aria-describedby={e.newsletterUrl ? "newsletterUrl-error" : "newsletterUrl-help"} />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full md:w-auto")}>
          <Newspaper size={16} strokeWidth={2.2} aria-hidden="true" />
          {pending ? "뉴스레터 읽는 중 (10초쯤)" : "가져오기"}
        </button>
        {state && !state.errors ? <FormMessage state={state} /> : null}
      </div>
    </form>
  );
}
