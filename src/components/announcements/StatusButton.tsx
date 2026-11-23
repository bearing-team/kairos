"use client";

import { useActionState } from "react";
import { changeStatus, type ActionState } from "@/app/(app)/applications/actions";
import type { ApplicationStatus } from "@/lib/status";

/** 상태 하나로 바꾸는 버튼 (사유 없는 전이). 성공하면 redirectTo로 이동 */
export function StatusButton({
  applicationId,
  to,
  label,
  pendingLabel = "바꾸는 중",
  redirectTo,
  className,
  formClassName = "",
}: {
  applicationId: string;
  to: ApplicationStatus;
  label: string;
  pendingLabel?: string;
  redirectTo?: string;
  className: string;
  formClassName?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changeStatus.bind(null, applicationId), null);
  return (
    <form action={action} className={formClassName}>
      <input type="hidden" name="to" value={to} />
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state && !state.ok ? (
        <p role="alert" className="m-0 mt-1 text-[12px] text-urgent-text">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
