"use client";

import { useActionState } from "react";
import { RotateCw } from "lucide-react";
import { syncEverythingNow, type SourceState } from "@/app/(app)/announcements/sources/actions";
import { buttonClass } from "@/components/ui/Button";

/** 소스 화면 헤더: 기본 API는 지금, 켜 둔 게시판은 뒤에서 확인 */
export function SyncAllButton() {
  const [state, action, pending] = useActionState<SourceState, FormData>(syncEverythingNow, null);
  return (
    <form action={action} className="flex w-full flex-col items-stretch gap-1 md:w-auto md:items-end">
      <button type="submit" disabled={pending} className={buttonClass("ink", "md", "w-full md:w-auto")}>
        <RotateCw size={16} strokeWidth={2.2} aria-hidden="true" className={pending ? "animate-spin" : ""} />
        {pending ? "가져오는 중" : "지금 모두 가져오기"}
      </button>
      {state ? (
        <p role="status" className={`m-0 text-[12px] ${state.ok ? "text-ink-3" : "text-urgent-text"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
