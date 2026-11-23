"use client";

import { useActionState, useState, useTransition } from "react";
import { useDismiss } from "@/components/ui/useDismiss";
import { AlertCircle, ChevronDown, PenLine, RotateCcw } from "lucide-react";
import { regenerateSection, saveSection, type DraftActionState } from "@/app/(app)/applications/draft-actions";
import { buttonClass } from "@/components/ui/Button";
import { charCount } from "@/lib/needsCheck";
import { lineDiff } from "@/lib/diff";
import { CheckText } from "./CheckText";
import { CommentThread, type CommentView } from "./CommentThread";

export type SectionView = {
  id: string;
  order: number;
  title: string;
  guidance: string | null;
  limitChars: number | null;
  content: string;
  status: "empty" | "generating" | "done" | "failed";
  error: string | null;
  needsCheck: string[];
  generatedBy: string | null;
  aiContent: string | null;
};

const REWRITE = [
  { mode: "again", label: "다시 쓰기" },
  { mode: "detail", label: "더 구체적으로" },
  { mode: "shorter", label: "짧게" },
  { mode: "criteria", label: "평가 기준 반영" },
] as const;

function Counter({ n, limit }: { n: number; limit: number | null }) {
  const over = limit !== null && n > limit;
  return (
    <span className={`text-[13px] tabular-nums ${over ? "font-semibold text-urgent-text" : "text-ink-3"}`}>
      {n.toLocaleString("ko-KR")}
      {limit ? ` / ${limit.toLocaleString("ko-KR")}자` : "자"}
    </span>
  );
}

export function SectionCard({ s, llm, comments, meId }: { s: SectionView; llm: boolean; comments: CommentView[]; meId: string }) {
  const [editing, setEditing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const edited = !!s.aiContent && s.aiContent !== s.content;
  const [text, setText] = useState(s.content);
  const [saveState, save, saving] = useActionState<DraftActionState, FormData>(async (prev, fd) => {
    const r = await saveSection(s.id, prev, fd);
    if (r?.ok) setEditing(false);
    return r;
  }, null);
  const [pending, start] = useTransition();
  const [rewriteMsg, setRewriteMsg] = useState<string | null>(null);
  const busy = s.status === "generating" || pending;
  const menu = useDismiss();

  const rewrite = (mode: (typeof REWRITE)[number]["mode"]) =>
    start(async () => {
      const r = await regenerateSection(s.id, mode);
      setRewriteMsg(r && !r.ok ? r.message : null);
    });

  return (
    <section id={`sec-${s.order}`} aria-labelledby={`sec-${s.order}-t`} className="scroll-mt-8 rounded-xl border border-line bg-surface p-6">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <h2 id={`sec-${s.order}-t`} className="m-0 min-w-0 flex-1 text-[18px] leading-[1.4] font-bold">
          {s.title}
        </h2>
        <div className="flex items-center gap-3">
          <Counter n={charCount(editing ? text : s.content)} limit={s.limitChars} />
          {llm && !editing ? (
            <details ref={menu} className="relative">
              <summary
                aria-disabled={busy}
                className={`flex h-9 cursor-pointer list-none items-center gap-1 rounded-full bg-surface-subtle px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken [&::-webkit-details-marker]:hidden ${busy ? "pointer-events-none opacity-45" : ""}`}
              >
                <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
                다시 쓰기
                <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-10 mt-2 flex w-40 flex-col rounded-lg border border-line bg-surface p-1 shadow-card">
                {REWRITE.map((r) => (
                  <button
                    key={r.mode}
                    type="button"
                    onClick={() => {
                      if (menu.current) menu.current.open = false;
                      rewrite(r.mode);
                    }}
                    className="h-9 rounded-md px-3 text-left text-[13px] font-medium text-ink-2 hover:bg-surface-subtle"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </header>

      {s.guidance ? <p className="m-0 mt-2 text-[13px] leading-[1.6] text-ink-3">작성 요령 · {s.guidance}</p> : null}

      <div className="mt-5">
        {s.status === "generating" || pending ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <span className="text-[13px] font-semibold text-[var(--status-drafting-fg)]">AI가 이 섹션을 쓰는 중이에요</span>
            {[92, 100, 84, 96, 60].map((w, i) => (
              <span key={i} className="h-3.5 animate-pulse rounded-full bg-surface-subtle" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : editing ? (
          <form action={save} className="flex flex-col gap-3">
            <label htmlFor={`ta-${s.id}`} className="sr-only">
              {s.title} 본문
            </label>
            <textarea
              id={`ta-${s.id}`}
              name="content"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={Math.min(30, Math.max(10, text.split("\n").length + 2))}
              className="w-full rounded-[12px] border border-line bg-surface p-4 text-[15px] leading-[1.75] text-ink outline-none focus:border-accent"
            />
            <p className="m-0 text-[12px] text-ink-3">모르는 숫자·실적은 【확인 필요: 무엇】처럼 남겨 두면 노란색으로 표시돼요.</p>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={saving} className={buttonClass("primary", "sm")}>
                {saving ? "저장하는 중" : "저장하기"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setText(s.content);
                  setEditing(false);
                }}
                className="h-9 rounded-full px-4 text-[14px] font-semibold text-ink-2 hover:bg-surface-subtle"
              >
                취소
              </button>
              {saveState && !saveState.ok ? (
                <span role="alert" className="text-[12px] text-urgent-text">
                  {saveState.message}
                </span>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            {s.status === "failed" ? (
              <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-surface-subtle p-3 text-[13px] text-urgent-text">
                <AlertCircle size={16} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 flex-none" />
                초안을 쓰지 못했어요. {s.error}
              </p>
            ) : null}
            {comparing && edited ? (
              <div className="flex flex-col rounded-lg border border-line p-3 text-[14px] leading-[1.7]" aria-label="AI 초안과 비교">
                {lineDiff(s.aiContent!, s.content).map((l, i) => (
                  <div
                    key={i}
                    className={`rounded px-2 whitespace-pre-wrap ${l.type === "add" ? "bg-[var(--status-submitted-bg)] text-[var(--status-submitted-fg)]" : l.type === "del" ? "bg-surface-subtle text-ink-3 line-through" : "text-ink-2"}`}
                  >
                    <span className="sr-only">{l.type === "add" ? "추가: " : l.type === "del" ? "삭제: " : ""}</span>
                    {l.text || " "}
                  </div>
                ))}
              </div>
            ) : s.content ? (
              <CheckText content={s.content} />
            ) : s.status !== "failed" ? (
              <p className="m-0 text-[14px] text-ink-3">아직 비어 있어요.</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setText(s.content);
                  setEditing(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-subtle px-4 text-[13px] font-semibold text-ink-2 hover:bg-surface-sunken"
              >
                <PenLine size={14} strokeWidth={2.2} aria-hidden="true" />
                {s.content ? "직접 고치기" : "직접 쓰기"}
              </button>
              {edited ? (
                <button type="button" aria-pressed={comparing} onClick={() => setComparing((v) => !v)} className="h-9 rounded-full px-3 text-[13px] font-semibold text-accent hover:bg-accent-soft">
                  {comparing ? "비교 닫기" : "AI 초안과 비교"}
                </button>
              ) : s.generatedBy === "human" ? (
                <span className="text-[12px] text-ink-3">사람이 쓴 내용</span>
              ) : null}
              {rewriteMsg ? (
                <span role="alert" className="text-[12px] text-urgent-text">
                  {rewriteMsg}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <CommentThread sectionId={s.id} comments={comments} meId={meId} />
    </section>
  );
}
