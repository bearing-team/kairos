"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Check, MessageSquare, RotateCcw, Trash2 } from "lucide-react";
import { addComment, deleteComment, setCommentResolved, type DraftActionState } from "@/app/(app)/applications/draft-actions";
import { Avatar } from "@/components/ui/Avatar";

export type CommentView = {
  id: string;
  body: string;
  when: string;
  author: { id: string; name: string | null; email: string | null };
  resolved: { by: string; when: string } | null;
};

/** 섹션 코멘트 (F5.2). 열린 코멘트가 있으면 펼쳐 둔다 */
export function CommentThread({ sectionId, comments, meId }: { sectionId: string; comments: CommentView[]; meId: string }) {
  const open = comments.filter((c) => !c.resolved);
  const [expanded, setExpanded] = useState(open.length > 0);
  const [showResolved, setShowResolved] = useState(false);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, adding] = useActionState<DraftActionState, FormData>(async (prev, fd) => {
    const r = await addComment(sectionId, prev, fd);
    if (r?.ok) form.current?.reset();
    return r;
  }, null);
  const resolvedCount = comments.length - open.length;
  const visible = showResolved ? comments : open;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink"
      >
        <MessageSquare size={15} strokeWidth={2.2} aria-hidden="true" />
        {comments.length ? `코멘트 ${open.length ? `${open.length}개 열림` : "모두 해결됨"}${resolvedCount && open.length ? ` · 해결 ${resolvedCount}` : ""}` : "코멘트 달기"}
      </button>

      {expanded ? (
        <div className={`mt-3 flex flex-col gap-3 ${pending ? "opacity-60" : ""}`}>
          {visible.map((c) => (
            <div key={c.id} className={`flex gap-3 rounded-lg p-3 ${c.resolved ? "bg-surface-subtle" : "bg-[var(--status-review-bg)]"}`}>
              <Avatar name={c.author.name} email={c.author.email} size={28} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-semibold text-ink">{c.author.name ?? c.author.email ?? "팀원"}</span>
                  <span className="text-ink-3">{c.when}</span>
                  {c.resolved ? (
                    <span className="text-ink-3">
                      · {c.resolved.by}님이 해결 ({c.resolved.when})
                    </span>
                  ) : null}
                </div>
                <p className={`m-0 text-[14px] leading-[1.6] whitespace-pre-wrap ${c.resolved ? "text-ink-3" : "text-ink"}`}>{c.body}</p>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => start(() => setCommentResolved(c.id, !c.resolved))}
                    className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-[12px] font-semibold text-ink-2 hover:bg-surface-sunken"
                  >
                    {c.resolved ? <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" /> : <Check size={13} strokeWidth={2.4} aria-hidden="true" />}
                    {c.resolved ? "다시 열기" : "해결"}
                  </button>
                  {c.author.id === meId ? (
                    <button
                      type="button"
                      onClick={() => start(() => deleteComment(c.id))}
                      aria-label="코멘트 지우기"
                      className="inline-flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
                    >
                      <Trash2 size={13} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {resolvedCount ? (
            <button type="button" onClick={() => setShowResolved((v) => !v)} className="w-fit text-[12px] font-semibold text-ink-3 hover:text-ink-2">
              {showResolved ? "해결된 코멘트 숨기기" : `해결된 코멘트 ${resolvedCount}개 보기`}
            </button>
          ) : null}
          <form ref={form} action={action} className="flex flex-col gap-2">
            <label htmlFor={`c-${sectionId}`} className="sr-only">
              코멘트
            </label>
            <textarea
              id={`c-${sectionId}`}
              name="body"
              rows={2}
              placeholder="이 섹션에 코멘트 남기기"
              className="w-full rounded-[12px] border border-line bg-surface p-3 text-[14px] leading-[1.6] outline-none focus:border-accent"
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={adding} className="h-9 rounded-full bg-ink-button px-4 text-[13px] font-semibold text-white hover:bg-ink-2 disabled:opacity-45">
                {adding ? "다는 중" : "코멘트 달기"}
              </button>
              {state && !state.ok ? (
                <span role="alert" className="text-[12px] text-urgent-text">
                  {state.message}
                </span>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
