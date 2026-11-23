"use client";

import { useActionState } from "react";
import { RotateCw } from "lucide-react";
import { runSyncNow, type SyncState } from "@/app/(app)/announcements/actions";
import { buttonClass } from "@/components/ui/Button";

/** 헤더의 "새 공고 가져오기": 기업마당·K-Startup을 바로 한 번 가져온다 */
export function SyncButton() {
  const [state, action, pending] = useActionState<SyncState, FormData>(runSyncNow, null);
  return (
    <form action={action} className="flex w-full flex-col items-stretch gap-1 md:w-auto md:items-end">
      <button type="submit" disabled={pending} className={buttonClass("ink", "md", "w-full md:w-auto")}>
        <RotateCw size={16} strokeWidth={2.2} aria-hidden="true" className={pending ? "animate-spin" : ""} />
        {pending ? "가져오는 중" : "새 공고 가져오기"}
      </button>
      {state ? (
        <p role="status" className={`m-0 text-[12px] ${state.ok ? "text-ink-3" : "text-urgent-text"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
