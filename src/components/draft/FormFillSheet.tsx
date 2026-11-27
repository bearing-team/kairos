"use client";

import { useActionState, useState } from "react";
import { Check, Download, LoaderCircle } from "lucide-react";
import { saveFormFields, type DraftActionState } from "@/app/(app)/applications/draft-actions";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";

export type FillField = {
  id: string;
  title: string;
  content: string;
  needsCheck: string[];
  status: string;
  error: string | null;
  field: { kind: "text" | "choice"; mode: "replace" | "append"; prefix: string | null; hint: string | null; options: string[]; multi: boolean } | null;
};

const EXAMPLE = /^\(?\s*(예시|예)\s*[)\]:]\s*/;

/** 양식 채우기 초안: 원본 양식의 표 모양대로 칸을 보여 주고 고치게 한다. 저장한 값으로 HWP를 받는다 */
export function FormFillSheet({ draftId, title, fileName, fields, working }: { draftId: string; title: string | null; fileName: string | null; fields: FillField[]; working: boolean }) {
  const [state, action, pending] = useActionState<DraftActionState, FormData>(saveFormFields.bind(null, draftId), null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<DraftActionState>(null);
  if (state !== savedAt) {
    setSavedAt(state);
    if (state?.ok) setDirty(false);
  }
  const empty = fields.filter((f) => !f.content).length;

  return (
    <form action={action} onSubmit={submitWith(action)} onChange={() => setDirty(true)} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 md:p-8">
      <div className="flex flex-col items-center gap-1 border-b-2 border-ink pb-3 text-center">
        <h2 className="m-0 text-[20px] leading-[1.4] font-extrabold tracking-[-0.02em] md:text-[22px]">{title ?? "신청 양식"}</h2>
        {fileName ? <span className="text-[12px] text-ink-3">{fileName}</span> : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-line-strong">
        {fields.map((f) => (
          <Row key={f.id} f={f} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending || working} className={buttonClass("primary", "md", "w-full md:w-auto")}>
            {pending ? "저장하는 중" : "저장하기"}
          </button>
          {state ? (
            <span role="status" className={`text-[13px] ${state.ok ? "text-ink-3" : "text-urgent-text"}`}>
              {state.message}
            </span>
          ) : empty ? (
            <span className="text-[13px] text-ink-3">빈 칸 {empty}개는 HWP에서도 비어 있어요</span>
          ) : null}
        </div>
        {dirty ? (
          <span className="text-[13px] text-ink-3">저장하면 HWP로 받을 수 있어요</span>
        ) : (
          <a href={`/api/drafts/${draftId}/export?format=hwp`} aria-disabled={working} className={buttonClass("soft", "md", `w-full md:w-auto ${working ? "pointer-events-none opacity-45" : ""}`)}>
            <Download size={16} strokeWidth={2.2} aria-hidden="true" />
            HWP로 받기
          </a>
        )}
      </div>
    </form>
  );
}

function Row({ f }: { f: FillField }) {
  const meta = f.field;
  const name = `f:${f.id}`;
  const generating = f.status === "generating";
  const long = !!meta?.hint && EXAMPLE.test(meta.hint);
  const placeholder = meta?.hint ? meta.hint.replace(EXAMPLE, "예: ").replace(/\n/g, " ") : meta?.prefix ? meta.prefix.replace(/[()]/g, "") : "";

  return (
    <div className="grid grid-cols-1 border-b border-line-strong last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex items-center bg-surface-sunken px-4 py-3 text-[14px] leading-[1.45] font-semibold text-ink md:justify-center md:text-center">
        <span>
          {f.title}
          {meta?.multi ? <span className="block text-[12px] font-medium text-ink-3">여러 개 고를 수 있어요</span> : null}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
        {generating ? (
          <span className="flex h-10 items-center gap-2 text-[13px] text-accent">
            <LoaderCircle size={14} strokeWidth={2.2} aria-hidden="true" className="animate-spin" />
            AI가 채우는 중이에요
          </span>
        ) : meta?.kind === "choice" ? (
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">{f.title}</legend>
            {meta.options.map((o) => (
              <Choice key={o} name={name} value={o} multi={meta.multi} defaultChecked={f.content.split(", ").includes(o)} />
            ))}
          </fieldset>
        ) : long ? (
          <textarea
            name={name}
            defaultValue={f.content}
            rows={4}
            placeholder={placeholder}
            aria-label={f.title}
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] leading-[1.7] text-ink placeholder:text-ink-disabled focus:border-accent focus:outline-none"
          />
        ) : (
          <div className="flex items-center gap-2">
            {meta?.prefix ? <span className="flex-none text-[13px] text-ink-3">{meta.prefix}</span> : null}
            <input
              name={name}
              defaultValue={f.content}
              placeholder={placeholder}
              aria-label={f.title}
              className="h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink placeholder:text-ink-disabled focus:border-accent focus:outline-none"
            />
          </div>
        )}
        {f.status === "failed" ? <span className="text-[12px] text-urgent-text">{f.error ?? "채우지 못했어요"}</span> : null}
        {!generating && f.needsCheck.length ? (
          <span className="w-fit rounded-md bg-check-bg px-2 py-0.5 text-[12px] leading-[1.6] font-semibold text-check-fg">확인 필요 · {f.needsCheck.join(" · ")}</span>
        ) : null}
      </div>
    </div>
  );
}

function Choice({ name, value, multi, defaultChecked }: { name: string; value: string; multi: boolean; defaultChecked: boolean }) {
  return (
    <label className="group relative flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[14px] font-medium text-ink-2 transition-colors has-[:checked]:border-transparent has-[:checked]:bg-accent-soft has-[:checked]:font-semibold has-[:checked]:text-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
      <input type={multi ? "checkbox" : "radio"} name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      <Check size={14} strokeWidth={2.6} aria-hidden="true" className="hidden group-has-[:checked]:block" />
      {value}
    </label>
  );
}
