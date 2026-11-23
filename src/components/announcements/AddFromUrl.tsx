"use client";

import { useActionState } from "react";
import { Link2 } from "lucide-react";
import { extractUrl, saveManualAnnouncement, type ExtractState, type SaveState } from "@/app/(app)/announcements/actions";
import { Field, TextArea, TextInput } from "@/components/form/fields";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";

export function AddFromUrl() {
  const [extract, extractAction, extracting] = useActionState<ExtractState, FormData>(extractUrl, null);
  const result = extract?.ok ? extract.result : null;

  return (
    <div className="flex flex-col gap-5">
      <form action={extractAction} onSubmit={submitWith(extractAction)} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 md:p-8">
        <Field
          label="공고 주소"
          name="url"
          help="지자체·진흥원 공고, 뉴스레터에서 본 공고의 페이지 주소를 붙여 넣으면 내용을 읽어 정리해요"
          error={extract && !extract.ok ? extract.message : undefined}
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <TextInput name="url" type="url" placeholder="https://" required invalid={!!extract && !extract.ok} />
            <button type="submit" disabled={extracting} className={buttonClass("primary", "md", "w-full flex-none md:w-auto")}>
              <Link2 size={16} strokeWidth={2.2} aria-hidden="true" />
              {extracting ? "읽는 중" : "공고 읽어오기"}
            </button>
          </div>
        </Field>
      </form>

      {result ? <ReviewForm key={result.page.url} result={result} /> : null}
    </div>
  );
}

function ReviewForm({ result }: { result: NonNullable<Extract<ExtractState, { ok: true }>>["result"] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveManualAnnouncement, null);
  const f = result.fields;
  const e = state?.errors ?? {};
  const v = (k: keyof NonNullable<typeof f>) => (f?.[k] as string | null | undefined) ?? "";

  return (
    <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[20px] leading-[1.4] font-bold">내용 확인</h2>
        <p className="m-0 text-[14px] leading-[1.7] text-ink-3">
          {result.note ?? "페이지에서 읽은 내용이에요. 틀린 곳을 고친 뒤 저장해 주세요."}
        </p>
      </div>
      <input type="hidden" name="url" value={result.page.url} />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="공고명" name="title" error={e.title} wide>
          <TextInput name="title" defaultValue={v("title") || result.page.title || ""} required invalid={!!e.title} />
        </Field>
        <Field label="주관 기관" name="organization">
          <TextInput name="organization" defaultValue={v("organization")} />
        </Field>
        <Field label="수행 기관" name="executingOrg">
          <TextInput name="executingOrg" defaultValue={v("executingOrg")} />
        </Field>
        <Field label="접수 시작일" name="applyStart" error={e.applyStart}>
          <TextInput name="applyStart" type="date" defaultValue={v("applyStart")} invalid={!!e.applyStart} />
        </Field>
        <Field label="접수 마감일" name="applyEnd" error={e.applyEnd}>
          <TextInput name="applyEnd" type="date" defaultValue={v("applyEnd")} invalid={!!e.applyEnd} />
        </Field>
        <Field label="접수 기간 원문" name="applyPeriodText" help="상시 모집처럼 날짜가 없으면 여기에">
          <TextInput name="applyPeriodText" defaultValue={v("applyPeriodText")} />
        </Field>
        <Field label="지원 규모" name="supportAmountText">
          <TextInput name="supportAmountText" defaultValue={v("supportAmountText")} />
        </Field>
        <Field label="지원 분야" name="category">
          <TextInput name="category" defaultValue={v("category")} />
        </Field>
        <Field label="지역 제한" name="regionLimit" help="전국이면 비워 두세요">
          <TextInput name="regionLimit" defaultValue={v("regionLimit")} />
        </Field>
        <Field label="지원 대상" name="target" wide>
          <TextArea name="target" defaultValue={v("target")} rows={3} />
        </Field>
        <Field label="요약" name="summary" wide>
          <TextArea name="summary" defaultValue={v("summary")} rows={5} />
        </Field>
        <Field label="신청 페이지" name="applyUrl" wide>
          <TextInput name="applyUrl" type="url" defaultValue={v("applyUrl")} />
        </Field>
      </div>

      {result.page.links.length > 0 ? (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[14px] font-semibold">첨부로 보이는 파일</legend>
          {result.page.links.map((l) => (
            <label key={l.href} className="flex items-center gap-3 text-[14px] text-ink-2">
              <input type="checkbox" name="attachment" value={`${l.href}\t${l.text}`} defaultChecked className="size-4 accent-[var(--color-accent)]" />
              <span className="min-w-0 truncate">{l.text || l.href}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full md:w-auto")}>
          {pending ? "저장하는 중" : "공고 저장하기"}
        </button>
        {state && !state.ok ? <p className="m-0 text-[13px] text-urgent-text">{state.message}</p> : null}
      </div>
    </form>
  );
}
