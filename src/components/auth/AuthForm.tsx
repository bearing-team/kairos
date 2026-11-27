"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/login/actions";
import { Field, TextInput } from "@/components/form/fields";
import { submitWith } from "@/components/form/useFormAction";
import { buttonClass } from "@/components/ui/Button";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "signup" ? signup : login, null);
  const e = state?.errors ?? {};
  const q = next !== "/" ? `&next=${encodeURIComponent(next)}` : "";

  return (
    <form action={action} onSubmit={submitWith(action)} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.message ? (
        <p role="alert" className="m-0 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] leading-[1.6] text-urgent-text">
          {state.message}
        </p>
      ) : null}

      {mode === "signup" ? (
        <Field label="이름" name="name" error={e.name}>
          <TextInput name="name" autoComplete="name" required invalid={!!e.name} />
        </Field>
      ) : null}
      <Field label="이메일" name="email" error={e.email}>
        <TextInput name="email" type="email" autoComplete="email" required invalid={!!e.email} />
      </Field>
      <Field label="비밀번호" name="password" help={mode === "signup" ? "8자 이상" : undefined} error={e.password}>
        <TextInput name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required invalid={!!e.password} />
      </Field>
      {mode === "signup" ? (
        <Field label="소속 회사" name="company" help="회사 프로필에 등록된 이름 (예: 베어링(주)). (주)·띄어쓰기는 달라도 괜찮아요" error={e.company}>
          <TextInput name="company" autoComplete="organization" required invalid={!!e.company} />
        </Field>
      ) : null}

      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "w-full")}>
        {pending ? (mode === "signup" ? "가입하는 중" : "로그인하는 중") : mode === "signup" ? "가입하고 시작하기" : "로그인"}
      </button>

      <p className="m-0 text-center text-[13px] text-ink-3">
        {mode === "signup" ? (
          <>
            이미 계정이 있나요?{" "}
            <Link href={`/login?mode=login${q}`} className="font-semibold text-accent">
              로그인
            </Link>
          </>
        ) : (
          <>
            처음이신가요?{" "}
            <Link href={`/login?mode=signup${q}`} className="font-semibold text-accent">
              회원가입
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
