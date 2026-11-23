"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React 19는 <form action={fn}> 제출 후 폼을 자동으로 비운다.
 * 검증 오류 때 입력이 사라지지 않도록 onSubmit에서 직접 액션을 호출한다 (자동 초기화 없음).
 */
export function submitWith(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(fd));
  };
}
