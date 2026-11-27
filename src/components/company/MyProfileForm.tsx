"use client";

import { useActionState } from "react";
import { saveMyProfile, type MemberState } from "@/app/(app)/company/member-actions";
import { Field, FormMessage, TextInput } from "@/components/form/fields";
import { submitWith } from "@/components/form/useFormAction";
import { buttonClass } from "@/components/ui/Button";

export function MyProfileForm({ name, slackUserId }: { name: string; slackUserId: string }) {
  const [state, action, pending] = useActionState<MemberState, FormData>(saveMyProfile, null);
  const e = state?.errors ?? {};
  return (
    <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="이름" name="name" error={e.name}>
          <TextInput name="name" defaultValue={name} required invalid={!!e.name} />
        </Field>
        <Field label="Slack 멤버 ID" name="slackUserId" help="넣으면 나에게 온 요청을 팀 채널에서 @멘션으로 알려요. Slack 프로필 → ⋮ → 멤버 ID 복사 (U로 시작)" error={e.slackUserId}>
          <TextInput name="slackUserId" defaultValue={slackUserId} placeholder="U0123ABCD" invalid={!!e.slackUserId} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
          {pending ? "저장하는 중" : "저장하기"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
