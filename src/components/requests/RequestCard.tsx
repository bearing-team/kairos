"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { respondRequest } from "@/app/(app)/requests/actions";
import { Avatar } from "@/components/ui/Avatar";
import { REQUEST_KIND, REQUEST_STATUS } from "@/lib/requests";
import type { RequestView } from "./view";

const KIND_TONE = {
  write: "bg-[var(--status-drafting-bg)] text-[var(--status-drafting-fg)]",
  supplement: "bg-[var(--status-interested-bg)] text-[var(--status-interested-fg)]",
  review: "bg-[var(--status-review-bg)] text-[var(--status-review-fg)]",
  other: "bg-[var(--status-triage-bg)] text-[var(--status-triage-fg)]",
} as const;

const STATUS_TONE = {
  open: "text-accent",
  done: "text-[var(--status-submitted-fg)]",
  muted: "text-ink-3",
} as const;

const who = (u: { name: string | null; email: string | null }) => u.name ?? u.email ?? "구성원";

/** 요청 한 건. compact는 초안 화면 옆 패널용 (공고 제목 대신 섹션만) */
export function RequestCard({ r, compact = false }: { r: RequestView; compact?: boolean }) {
  const [mode, setMode] = useState<null | "done" | "declined">(null);
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (action: "done" | "declined" | "canceled" | "reopen", text?: string) =>
    start(async () => {
      const res = await respondRequest(r.id, action, text);
      if (res?.ok) {
        setMode(null);
        setReply("");
        setMsg(null);
      } else setMsg(res?.message ?? "처리하지 못했어요");
    });

  const st = REQUEST_STATUS[r.status];
  const other = r.role === "to" ? r.from : r.to;
  const line = r.role === "to" ? `${who(r.from)} → 나` : r.role === "from" ? `나 → ${who(r.to)}` : `${who(r.from)} → ${who(r.to)}`;

  return (
    <article className={`flex flex-col gap-3 ${compact ? "rounded-lg bg-surface-subtle p-3" : "rounded-xl border border-line bg-surface p-5"} ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${KIND_TONE[r.kind]}`}>{REQUEST_KIND[r.kind].label}</span>
        {r.status !== "open" ? <span className={`font-semibold ${STATUS_TONE[st.tone]}`}>{st.label}</span> : null}
        {r.due ? (
          <span className={`inline-flex items-center gap-1 font-semibold ${r.due.urgent ? "text-urgent-text" : "text-ink-2"}`}>
            <CalendarClock size={13} strokeWidth={2.2} aria-hidden="true" />
            {r.due.label}
          </span>
        ) : null}
        <span className="ml-auto text-ink-3">{r.created}</span>
      </div>

      {compact ? null : (
        <Link href={r.href} className="group flex items-start gap-1.5 text-[16px] leading-[1.45] font-bold text-ink hover:text-accent">
          <span className="min-w-0">{r.title}</span>
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" className="mt-1 flex-none opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      )}

      <div className="flex items-start gap-2.5">
        <Avatar name={other.name} email={other.email} size={compact ? 24 : 28} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[12px] font-semibold text-ink-3">
            {line}
            {r.sectionTitle ? (
              <>
                {" · "}
                <Link href={r.href} className="text-ink-2 underline-offset-2 hover:underline">
                  {r.sectionTitle}
                </Link>
              </>
            ) : null}
          </span>
          <p className={`m-0 whitespace-pre-wrap text-ink-2 ${compact ? "line-clamp-4 text-[13px] leading-[1.55]" : "text-[14px] leading-[1.65]"}`}>{r.message}</p>
          {r.reply ? (
            <p className="m-0 mt-1 rounded-md bg-surface px-3 py-2 text-[13px] leading-[1.55] text-ink-2">
              <span className="font-semibold">{who(r.to)}</span>
              {r.responded ? <span className="text-ink-3"> · {r.responded}</span> : null}
              <br />
              {r.reply}
            </p>
          ) : null}
        </div>
      </div>

      {mode ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(mode, reply);
          }}
        >
          <label htmlFor={`reply-${r.id}`} className="sr-only">
            {mode === "done" ? "남길 말" : "거절 사유"}
          </label>
          <textarea
            id={`reply-${r.id}`}
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={mode === "done" ? "남길 말 (선택) — 예: 3번 섹션에 매출 근거 넣었어요" : "거절 사유 — 예: 이번 주는 다른 공고 마감이라 어려워요"}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13px] leading-[1.6] outline-none focus:border-accent"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || (mode === "declined" && !reply.trim())}
              className="h-8 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-45"
            >
              {mode === "done" ? "완료로 표시" : "거절하기"}
            </button>
            <button type="button" onClick={() => setMode(null)} className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-subtle">
              그만두기
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {r.status === "open" && r.role === "to" ? (
            <>
              <button type="button" disabled={pending} onClick={() => setMode("done")} className="h-8 rounded-full bg-accent-soft px-3.5 text-[13px] font-semibold text-accent hover:bg-accent-soft-2">
                완료
              </button>
              <button type="button" disabled={pending} onClick={() => setMode("declined")} className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken">
                거절
              </button>
            </>
          ) : null}
          {r.status === "open" && r.role === "from" ? (
            <button type="button" disabled={pending} onClick={() => act("canceled")} className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken">
              요청 취소
            </button>
          ) : null}
          {r.status !== "open" && r.role !== "other" ? (
            <button type="button" disabled={pending} onClick={() => act("reopen")} className="h-8 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken">
              다시 열기
            </button>
          ) : null}
        </div>
      )}
      {msg ? (
        <p role="alert" className="m-0 text-[12px] text-urgent-text">
          {msg}
        </p>
      ) : null}
    </article>
  );
}
