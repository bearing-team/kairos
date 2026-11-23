"use client";

import { useActionState, useRef, useState } from "react";
import { X } from "lucide-react";
import { changeStatus, type ActionState } from "@/app/(app)/applications/actions";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";

const PRESETS = ["지원 자격이 안 돼요", "우리 사업과 맞지 않아요", "일정이 맞지 않아요", "지원 규모가 작아요", "이미 지원했어요"];

/** "제외하기" — 사유 필수 (PRD F3.4: 사람의 판단 기록) */
export function ExcludeDialog({ applicationId, className }: { applicationId: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await changeStatus(applicationId, prev, fd);
    if (r?.ok) ref.current?.close();
    return r;
  }, null);

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={className}>
        제외하기
      </button>
      <dialog
        ref={ref}
        aria-labelledby="exclude-title"
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-[rgba(25,28,36,0.32)]"
      >
        <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-5 p-6">
          <input type="hidden" name="to" value="excluded" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="exclude-title" className="m-0 text-[20px] font-bold">
                이 공고를 제외할까요?
              </h2>
              <p className="m-0 text-[13px] text-ink-3">사유는 나중에 점수를 고칠 때 근거로 써요. 다시 검토하기로 언제든 되돌릴 수 있어요.</p>
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="닫기" className="flex size-9 flex-none items-center justify-center rounded-full text-ink-3 hover:bg-surface-subtle">
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="자주 쓰는 사유">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                aria-pressed={reason === p}
                className={`h-9 rounded-full px-4 text-[13px] font-semibold transition-colors ${reason === p ? "bg-accent-soft text-accent" : "bg-surface-subtle text-ink-2 hover:bg-surface-sunken"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink-2">제외 사유</span>
            <textarea
              name="reason"
              required
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 매출 실적 요건(1억 이상)을 못 채워요"
              className="rounded-md border border-line-strong bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent"
            />
          </label>
          {state && !state.ok ? (
            <p role="alert" className="m-0 text-[13px] text-urgent-text">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className={buttonClass("soft", "md")}>
              취소
            </button>
            <button type="submit" disabled={pending || !reason.trim()} className={buttonClass("ink", "md")}>
              {pending ? "제외하는 중" : "제외하기"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
