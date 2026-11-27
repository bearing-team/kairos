"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { sendRequest, type RequestActionState } from "@/app/(app)/requests/actions";
import { submitWith } from "@/components/form/useFormAction";
import { buttonClass } from "@/components/ui/Button";
import { REQUEST_KIND, REQUEST_KINDS, type RequestKind } from "@/lib/requests";

type Member = { id: string; name: string | null; email: string | null };

const control = "w-full rounded-md border border-line-strong bg-surface px-3 text-[13px] text-ink outline-none focus:border-accent aria-[invalid=true]:border-urgent";

/** 같은 회사 구성원에게 요청 보내기 (초안 화면 옆 패널). 처음엔 버튼만, 누르면 펼친다 */
export function RequestForm({ applicationId, members, sections, today }: { applicationId: string; members: Member[]; sections: { id: string; title: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RequestKind>("supplement");
  // 보낸 뒤에는 접는다 (폼이 사라지니 입력도 비워진다). 오류일 때는 입력을 남긴다
  const [state, action, pending] = useActionState<RequestActionState, FormData>(async (prev, fd) => {
    const r = await sendRequest(applicationId, prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, null);
  const e = state?.errors ?? {};

  if (!members.length) {
    return <p className="m-0 text-[13px] leading-[1.6] text-ink-3">같은 회사 구성원이 가입하면 작성·보강·리뷰를 요청할 수 있어요.</p>;
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => setOpen(true)} className={buttonClass("soft", "sm", "w-full")}>
          <Send size={14} strokeWidth={2.2} aria-hidden="true" />
          구성원에게 요청하기
        </button>
        {state?.ok ? (
          <p role="status" className="m-0 text-[12px] text-[var(--status-submitted-fg)]">
            {state.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-3 rounded-lg border border-line p-3">
      <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
        <legend className="mb-1.5 text-[12px] font-semibold text-ink-2">무엇을 부탁할까요</legend>
        {REQUEST_KINDS.map((k) => (
          <label
            key={k}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-semibold ${kind === k ? "bg-accent text-white" : "bg-surface-subtle text-ink-2 hover:bg-surface-sunken"}`}
          >
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {REQUEST_KIND[k].label.replace(" 요청", "")}
          </label>
        ))}
      </fieldset>
      <p className="m-0 -mt-1 text-[12px] leading-[1.5] text-ink-3">{REQUEST_KIND[kind].hint}</p>

      <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-2">
        받는 사람
        <select name="toId" required defaultValue="" aria-invalid={!!e.toId || undefined} className={`${control} h-10`}>
          <option value="" disabled>
            구성원 고르기
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.email}
            </option>
          ))}
        </select>
        {e.toId ? <span className="font-normal text-urgent-text">{e.toId}</span> : null}
      </label>

      {sections.length ? (
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-2">
          섹션 (선택)
          <select name="sectionId" defaultValue="" className={`${control} h-10`}>
            <option value="">문서 전체</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-2">
        메시지
        <textarea
          name="message"
          rows={3}
          required
          maxLength={2000}
          aria-invalid={!!e.message || undefined}
          placeholder={
            kind === "supplement"
              ? "예: 시장 규모에 최근 3년 수치와 출처를 넣어 주세요"
              : kind === "write"
                ? "예: 팀 구성 섹션을 써 주세요. 경력은 링크드인 기준으로"
                : kind === "review"
                  ? "예: 제출 전에 사업화 전략 위주로 봐 주세요"
                  : "예: 사업자등록증 사본을 첨부해 주세요"
          }
          className={`${control} py-2 leading-[1.6]`}
        />
        {e.message ? <span className="font-normal text-urgent-text">{e.message}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-ink-2">
        기한 (선택)
        <input type="date" name="due" min={today} className={`${control} h-10`} />
      </label>

      {state && !state.ok ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {state.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass("ink", "sm", "flex-1")}>
          {pending ? "보내는 중" : "요청 보내기"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-subtle">
          닫기
        </button>
      </div>
    </form>
  );
}
