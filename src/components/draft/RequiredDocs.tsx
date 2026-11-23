"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, Circle, MinusCircle, X } from "lucide-react";
import { addRequiredDoc, removeRequiredDoc, setRequiredDocStatus, type DraftActionState } from "@/app/(app)/applications/draft-actions";

type Doc = { id: string; name: string; note: string | null; required: boolean; status: "ready" | "missing" | "na"; source: string };

const NEXT = { missing: "ready", ready: "na", na: "missing" } as const;
const LABEL = { ready: "준비됨", missing: "미첨부", na: "해당 없음" } as const;

/** 제출 서류 체크리스트 (DESIGN.md 5.3: 준비됨 초록 / 미첨부 흐림). 아이콘을 누르면 상태가 바뀐다 */
export function RequiredDocs({ applicationId, docs, editable = true }: { applicationId: string; docs: Doc[]; editable?: boolean }) {
  const [pending, start] = useTransition();
  const [addState, add, adding] = useActionState<DraftActionState, FormData>(addRequiredDoc.bind(null, applicationId), null);
  const ready = docs.filter((d) => d.status === "ready").length;
  const counted = docs.filter((d) => d.status !== "na").length;

  return (
    <section aria-labelledby="docs-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="docs-title" className="m-0 text-[15px] font-bold">
          제출 서류
        </h2>
        {docs.length ? (
          <span className="text-[12px] text-ink-3">
            {ready}/{counted} 준비됨
          </span>
        ) : null}
      </div>
      {docs.length ? (
        <ul className={`m-0 flex list-none flex-col gap-1 p-0 ${pending ? "opacity-60" : ""}`}>
          {docs.map((d) => {
            const Icon = d.status === "ready" ? CheckCircle2 : d.status === "na" ? MinusCircle : Circle;
            return (
              <li key={d.id} className="group flex items-start gap-2 rounded-md py-1">
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => start(() => setRequiredDocStatus(d.id, NEXT[d.status]))}
                  aria-label={`${d.name}: ${LABEL[d.status]} (눌러서 ${LABEL[NEXT[d.status]]}으로)`}
                  className="mt-0.5 flex-none rounded-full disabled:cursor-default"
                >
                  <Icon size={18} strokeWidth={2.2} aria-hidden="true" className={d.status === "ready" ? "text-ready" : "text-ink-disabled"} />
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[14px] leading-[1.5] ${d.status === "ready" ? "text-ink" : d.status === "na" ? "text-ink-disabled line-through" : "text-ink-2"}`}>
                    {d.name}
                    {!d.required ? <span className="ml-1.5 text-[12px] text-ink-3">해당 시</span> : null}
                  </span>
                  {d.note ? <span className="text-[12px] leading-[1.5] text-ink-3">{d.note}</span> : null}
                </div>
                {editable && d.source === "manual" ? (
                  <button
                    type="button"
                    onClick={() => start(() => removeRequiredDoc(d.id))}
                    aria-label={`${d.name} 지우기`}
                    className="mt-0.5 flex-none rounded-full p-0.5 text-ink-disabled opacity-0 group-hover:opacity-100 hover:text-ink-2 focus-visible:opacity-100"
                  >
                    <X size={14} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-[13px] text-ink-3">초안을 만들면 공고문에서 제출 서류를 찾아 채워요.</p>
      )}
      {editable ? (
        <form action={add} className="flex gap-2">
          <label htmlFor={`doc-${applicationId}`} className="sr-only">
            서류 이름
          </label>
          <input
            id={`doc-${applicationId}`}
            name="name"
            placeholder="서류 추가"
            className="h-9 min-w-0 flex-1 rounded-[12px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-accent"
          />
          <button type="submit" disabled={adding} className="h-9 flex-none rounded-full bg-surface-subtle px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken">
            추가
          </button>
        </form>
      ) : null}
      {addState && !addState.ok ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {addState.message}
        </p>
      ) : null}
    </section>
  );
}
