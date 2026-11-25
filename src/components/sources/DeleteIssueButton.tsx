"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNewsletter } from "@/app/(app)/announcements/sources/actions";

/** 호 기록만 지운다 (넣은 공고는 남김) */
export function DeleteIssueButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("이 뉴스레터 기록을 지울까요? 전체 공고에 넣은 항목은 그대로 남아요.")) return;
        start(async () => {
          await deleteNewsletter(id);
          router.push("/announcements/sources");
        });
      }}
      className="h-10 rounded-full px-4 text-[14px] font-semibold text-urgent-text hover:bg-surface-subtle"
    >
      {pending ? "지우는 중" : "기록 지우기"}
    </button>
  );
}
