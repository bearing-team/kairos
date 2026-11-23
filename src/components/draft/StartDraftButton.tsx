"use client";

import { useActionState } from "react";
import { startDraft, generateMissing, type DraftActionState } from "@/app/(app)/applications/draft-actions";

export function StartDraftButton({ applicationId, label, className }: { applicationId: string; label: string; className: string }) {
  const [state, action, pending] = useActionState<DraftActionState, FormData>(startDraft.bind(null, applicationId), null);
  return (
    <form action={action} className="flex flex-col gap-1">
      <button type="submit" disabled={pending} className={className}>
        {pending ? "시작하는 중" : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function GenerateMissingButton({ draftId, label, className }: { draftId: string; label: string; className: string }) {
  const [state, action, pending] = useActionState<DraftActionState, FormData>(generateMissing.bind(null, draftId), null);
  return (
    <form action={action} className="flex flex-col gap-1">
      <button type="submit" disabled={pending} className={className}>
        {pending ? "시작하는 중" : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
