"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Star, X } from "lucide-react";
import { quickTriage } from "@/app/(app)/applications/actions";
import { useDismiss } from "@/components/ui/useDismiss";
import type { ApplicationStatus } from "@/lib/status";

type To = "interested" | "excluded";
type Toast = { id: number; message: string; undo?: () => Promise<void>; error?: boolean };
type Act = (id: string, from: ApplicationStatus, to: To, opts: { reason?: string; undoHref: string }) => Promise<boolean>;

const DONE: Record<To, string> = { interested: "관심 공고로 옮겼어요", excluded: "관심 없음으로 뺐어요" };
/** 관심 없음 사유 (= 제외 사유). 맨 위는 사유 없이 빠르게 */
const REASONS = ["관심 없음", "지원 대상이 아니에요", "우리 사업과 맞지 않아요", "일정이 맞지 않아요", "행사·소식이에요"];
const TOAST_MS = 6000;
export const UNSORTED_HREF = "/announcements?status=unsorted";

const Ctx = createContext<Act | null>(null);

/**
 * 1차 분류 액션 + 되돌리기 토스트. 앱 레이아웃에 두어 다음 공고로 넘어가도 토스트가 남는다.
 * 되돌리기는 상태를 '검토 전'으로 돌리고 그 공고로 다시 데려간다
 */
export function TriageProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((t: Omit<Toast, "id">) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...t, id });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const act = useCallback<Act>(
    async (id, from, to, { reason, undoHref }) => {
      const r = await quickTriage(id, to, reason, from);
      if (!r.ok) {
        show({ message: r.message, error: true });
        return false;
      }
      show({
        message: DONE[to],
        undo: async () => {
          const u = await quickTriage(id, "triage", undefined, to);
          if (!u.ok) return show({ message: u.message, error: true });
          show({ message: "되돌렸어요" });
          router.push(undoHref);
        },
      });
      return true;
    },
    [show, router],
  );

  return (
    <Ctx.Provider value={act}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-40 z-50 flex justify-center px-4 md:bottom-28">
        {toast ? (
          <div
            key={toast.id}
            role={toast.error ? "alert" : "status"}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-ink-button py-2.5 pr-2.5 pl-5 text-[14px] font-semibold text-white shadow-card"
          >
            <span>{toast.message}</span>
            {toast.undo ? <UndoButton onUndo={toast.undo} onStart={() => clearTimeout(timer.current)} /> : <span className="w-1" />}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

function UndoButton({ onUndo, onStart }: { onUndo: () => Promise<void>; onStart: () => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        onStart();
        start(onUndo);
      }}
      className="h-8 rounded-full bg-white/15 px-4 text-[13px] font-semibold text-white hover:bg-white/25 disabled:opacity-60"
    >
      {pending ? "되돌리는 중" : "되돌리기"}
    </button>
  );
}

const pill = "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors duration-[120ms] disabled:opacity-45";

/**
 * 상세 화면 아래에 붙는 분류 바 (분류 전 공고만). 내용을 보고 관심 / 관심 없음을 고르면 다음 분류 전 공고로 넘어간다.
 * position은 대기열에서 몇 번째인지(마감·중복이라 대기열에 없으면 null)
 */
export function TriageBar({
  applicationId,
  announcementId,
  status,
  position,
  total,
  nextHref,
}: {
  applicationId: string;
  announcementId: string;
  status: ApplicationStatus;
  position: number | null;
  total: number;
  nextHref: string | null;
}) {
  const act = useContext(Ctx);
  const router = useRouter();
  const [pending, start] = useTransition();
  const menu = useDismiss<HTMLDetailsElement>();
  if (!act) return null;

  const run = (to: To, reason?: string) => {
    menu.current?.removeAttribute("open");
    start(async () => {
      const ok = await act(applicationId, status, to, { reason, undoHref: `/announcements/${announcementId}` });
      if (ok) router.push(nextHref ?? UNSORTED_HREF);
    });
  };

  return (
    <div className="pointer-events-none sticky bottom-20 z-30 flex justify-center md:bottom-6">
      <div
        role="group"
        aria-label="1차 분류"
        className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-[28px] border border-line bg-surface p-2 shadow-card md:flex-nowrap md:rounded-full md:pl-5"
      >
        <span className="hidden text-[13px] font-semibold whitespace-nowrap text-ink-3 md:inline">
          분류 전 {position ? `${position} / ${total}` : `${total}건 남음`}
        </span>
        <details ref={menu} className="relative">
          <summary
            className={`${pill} cursor-pointer list-none bg-surface-subtle text-ink-2 hover:bg-surface-sunken [&::-webkit-details-marker]:hidden ${pending ? "pointer-events-none opacity-45" : ""}`}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
            관심 없음
          </summary>
          <div role="menu" aria-label="관심 없는 이유" className="absolute bottom-full left-0 z-20 mb-2 flex w-56 flex-col rounded-lg border border-line bg-surface p-1.5 shadow-card">
            {REASONS.map((r, i) => (
              <button
                key={r}
                type="button"
                role="menuitem"
                onClick={() => run("excluded", r)}
                className={`rounded-md px-3 py-2 text-left text-[13px] hover:bg-surface-subtle ${i === 0 ? "font-semibold text-ink" : "text-ink-2"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </details>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("interested")}
          className={`${pill} bg-[var(--status-interested-bg)] text-[var(--status-interested-fg)] hover:brightness-95`}
        >
          <Star size={16} strokeWidth={2} aria-hidden="true" />
          {pending ? "옮기는 중" : "관심"}
        </button>
        {nextHref ? (
          <Link href={nextHref} className={`${pill} text-ink-3 hover:bg-surface-subtle hover:text-ink-2`}>
            건너뛰기
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
