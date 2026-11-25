"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RotateCw } from "lucide-react";
import { checkBoardNow, deleteBoard, setBoardEnabled, type SourceState } from "@/app/(app)/announcements/sources/actions";
import { buttonClass } from "@/components/ui/Button";
import { useDismiss } from "@/components/ui/useDismiss";

/** 게시판 줄의 오른쪽: 지금 확인 + 더보기(매일 확인 끄기·켜기, 연결 끊기) */
export function BoardActions({ id, name, enabled, checking }: { id: string; name: string; enabled: boolean; checking: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<SourceState>(null);
  const router = useRouter();
  const menu = useDismiss();

  const run = (fn: () => Promise<SourceState>) => {
    start(async () => {
      const r = await fn();
      setMsg(r);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button type="button" disabled={pending || checking} onClick={() => run(() => checkBoardNow(id))} className={buttonClass("soft", "sm")}>
          <RotateCw size={14} strokeWidth={2.2} aria-hidden="true" className={checking ? "animate-spin" : ""} />
          {checking ? "확인 중" : "지금 확인"}
        </button>
        <details ref={menu} className="relative">
          <summary
            aria-label={`${name} 더보기`}
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-subtle hover:text-ink [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex w-44 flex-col rounded-lg border border-line bg-surface p-1 shadow-card">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                run(() => setBoardEnabled(id, !enabled));
              }}
              className="h-9 rounded-md px-3 text-left text-[13px] font-medium text-ink-2 hover:bg-surface-subtle">
              {enabled ? "매일 확인 끄기" : "매일 확인 켜기"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                if (window.confirm(`${name} 연결을 끊을까요? 이미 가져온 공고는 남아요.`)) run(() => deleteBoard(id));
              }}
              className="h-9 rounded-md px-3 text-left text-[13px] font-medium text-urgent-text hover:bg-[var(--status-review-bg)]"
            >
              연결 끊기
            </button>
          </div>
        </details>
      </div>
      {msg && !msg.ok ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {msg.message}
        </p>
      ) : null}
    </div>
  );
}
