"use client";

import { useActionState } from "react";
import { RotateCw } from "lucide-react";
import { rescore, type ActionState } from "@/app/(app)/applications/actions";

export function RescoreButton({ matchId, label = "점수 다시 매기기" }: { matchId: string; label?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(rescore.bind(null, matchId), null);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:text-accent-hover disabled:opacity-60">
        <RotateCw size={14} strokeWidth={2.2} aria-hidden="true" className={pending ? "animate-spin" : ""} />
        {pending ? "매기는 중" : label}
      </button>
      {state ? <p role="status" className={`m-0 text-[12px] ${state.ok ? "text-ink-3" : "text-urgent-text"}`}>{state.message}</p> : null}
    </form>
  );
}
