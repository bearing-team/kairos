"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { setReviewers } from "@/app/(app)/applications/draft-actions";
import { Avatar } from "@/components/ui/Avatar";
import { useDismiss } from "@/components/ui/useDismiss";

type U = { id: string; name: string | null; email: string | null };

/** 리뷰어 지정 (F5.2). 체크하면 바로 저장 */
export function ReviewerPicker({ applicationId, users, selected }: { applicationId: string; users: U[]; selected: string[] }) {
  const [ids, setIds] = useState(selected);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const menu = useDismiss();
  const chosen = users.filter((u) => ids.includes(u.id));

  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    const before = ids;
    setIds(next);
    start(async () => {
      const r = await setReviewers(applicationId, next);
      if (!r?.ok) {
        setIds(before);
        setMsg(r?.message ?? "저장하지 못했어요");
      } else setMsg(null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((u) => (
          <span key={u.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-subtle pr-3 pl-1 text-[13px] font-medium">
            <Avatar name={u.name} email={u.email} size={24} />
            {u.name ?? u.email}
          </span>
        ))}
        <details ref={menu} className="relative">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-accent hover:bg-accent-soft [&::-webkit-details-marker]:hidden">
            <UserPlus size={14} strokeWidth={2.2} aria-hidden="true" />
            {chosen.length ? "바꾸기" : "리뷰어 지정"}
          </summary>
          <fieldset className={`absolute left-0 z-10 m-0 mt-1 flex w-56 flex-col rounded-lg border border-line bg-surface p-1 shadow-card ${pending ? "opacity-60" : ""}`}>
            <legend className="sr-only">리뷰어</legend>
            {users.map((u) => (
              <label key={u.id} className="flex h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] hover:bg-surface-subtle">
                <input type="checkbox" checked={ids.includes(u.id)} onChange={() => toggle(u.id)} className="size-4 accent-[var(--color-accent)]" />
                <Avatar name={u.name} email={u.email} size={24} />
                <span className="min-w-0 truncate">{u.name ?? u.email}</span>
              </label>
            ))}
          </fieldset>
        </details>
      </div>
      {msg ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
