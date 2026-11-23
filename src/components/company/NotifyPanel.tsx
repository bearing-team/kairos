"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendNotificationNow, type NotifyState } from "@/app/(app)/company/notify-actions";
import { buttonClass } from "@/components/ui/Button";

export function SendNowButton({ kind, label, variant, disabled }: { kind: "digest" | "deadline"; label: string; variant: "primary" | "soft"; disabled: boolean }) {
  const [state, action, pending] = useActionState<NotifyState, FormData>(sendNotificationNow.bind(null, kind), null);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <button type="submit" disabled={disabled || pending} className={buttonClass(variant, "md")}>
        <Send size={16} strokeWidth={2.2} aria-hidden="true" />
        {pending ? "보내는 중" : label}
      </button>
      {state ? (
        <p role="status" className={`m-0 text-[12px] ${state.ok ? "text-ink-3" : "text-urgent-text"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
