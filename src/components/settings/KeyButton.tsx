"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { deleteKey, saveKey, type KeyState } from "@/app/(app)/company/key-actions";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";
import { useDismiss } from "@/components/ui/useDismiss";

export type KeyView = { name: string; label: string; source: "env" | "db" | "none"; last4: string | null; broken: boolean; placeholder: string };

/** 키 넣기·바꾸기 팝오버. 값은 서버로 보내기만 하고 화면에는 끝 4자리만 */
export function KeyButton({ k, size = "sm" }: { k: KeyView; size?: "sm" | "md" }) {
  const menu = useDismiss();
  const router = useRouter();
  const [state, action, pending] = useActionState<KeyState, FormData>(saveKey, null);
  const [removed, setRemoved] = useState<KeyState>(null);
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      menu.current?.removeAttribute("open");
      router.refresh();
    }
  }, [state, menu, router]);

  if (k.source === "env") return <span className="text-[12px] font-semibold whitespace-nowrap text-ink-3">.env에서 읽어요</span>;
  const has = k.source === "db" && !k.broken;
  const msg = removed ?? state;

  return (
    <details ref={menu} className="relative">
      <summary className={`${buttonClass("soft", size)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <KeyRound size={14} strokeWidth={2.2} aria-hidden="true" />
        {has ? "키 바꾸기" : "키 넣기"}
      </summary>
      <form
        action={action}
        onSubmit={submitWith(action)}
        className="absolute right-0 z-20 mt-2 flex w-[min(340px,calc(100vw-48px))] flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card"
      >
        <input type="hidden" name="name" value={k.name} />
        <label htmlFor={`key-${k.name}`} className="text-[14px] font-semibold text-ink">
          {k.label}
        </label>
        <input
          id={`key-${k.name}`}
          name="value"
          type="password"
          autoComplete="off"
          spellCheck={false}
          required
          placeholder={k.placeholder}
          className="h-11 w-full rounded-md border border-line-strong bg-surface px-4 text-[14px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
        />
        <p className="m-0 text-[12px] leading-[1.5] text-ink-3">저장하기 전에 한 번 확인해요. 서버에 암호화해서 두고, 화면에는 끝 4자리만 보여요.</p>
        <div className="flex items-center justify-between gap-2">
          {k.source === "db" ? (
            <button
              type="button"
              disabled={removing}
              onClick={() => {
                if (!window.confirm(`${k.label}를 지울까요? 지우면 이 기능이 멈춰요.`)) return;
                startRemove(async () => {
                  setRemoved(await deleteKey(k.name));
                  router.refresh();
                });
              }}
              className="text-[13px] font-semibold text-urgent-text hover:underline"
            >
              지우기
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? "확인하는 중" : "확인하고 저장"}
          </button>
        </div>
        {msg ? (
          <p role={msg.ok ? "status" : "alert"} className={`m-0 text-[13px] ${msg.ok ? "text-[var(--status-submitted-fg)]" : "text-urgent-text"}`}>
            {msg.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
