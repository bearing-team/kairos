"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, MessageSquare } from "lucide-react";
import { moveCard } from "@/app/(app)/applications/actions";
import { Avatar } from "@/components/ui/Avatar";
import { TimelineBar } from "@/components/ui/TimelineBar";
import { allowedNext } from "@/lib/transitions";
import { withRo } from "@/lib/format";
import { useDismiss } from "@/components/ui/useDismiss";
import type { ApplicationStatus } from "@/lib/status";
import type { BoardCard, BoardColumnKey } from "@/server/board";

type Column = { key: BoardColumnKey; label: string; dropStatus: ApplicationStatus; dot: string };
type Toast = { id: number; text: string; ok: boolean };

const canDrop = (c: BoardCard, col: Column) => c.status !== col.dropStatus && allowedNext(c.status).includes(col.dropStatus);

/** 칸반 (DESIGN.md 5.4). 드래그 또는 카드의 "옮기기"로 상태 변경 → 서버 검증, 실패면 원위치 + 토스트 */
export function BoardView({ columns, initial, recommendedMore }: { columns: readonly Column[]; initial: Record<BoardColumnKey, BoardCard[]>; recommendedMore: number }) {
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<{ card: BoardCard; from: BoardColumnKey } | null>(null);
  const [over, setOver] = useState<BoardColumnKey | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, start] = useTransition();
  const router = useRouter();
  const seq = useRef(0);

  // 서버에서 새 목록이 오면(새로고침) 낙관적 상태를 버리고 맞춘다
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setCards(initial);
  }

  const toast = (text: string, ok: boolean) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, ok }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  const move = (card: BoardCard, from: BoardColumnKey, to: Column) => {
    if (!canDrop(card, to)) {
      if (card.status !== to.dropStatus) toast(`여기로는 옮길 수 없어요 (${to.label})`, false);
      return;
    }
    const before = cards;
    // 먼저 옮겨 보여 주고, 서버가 거절하면 되돌린다
    setCards((c) => ({ ...c, [from]: c[from].filter((x) => x.id !== card.id), [to.key]: [{ ...card, status: to.dropStatus }, ...c[to.key]] }));
    start(async () => {
      const r = await moveCard(card.id, card.status, to.dropStatus);
      if (!r?.ok) {
        setCards(before);
        toast(r?.message ?? "옮기지 못했어요", false);
      } else {
        toast(to.dropStatus === "drafting" ? "초안 작성으로 옮겼어요. 초안을 만들기 시작해요" : r.message, true);
        router.refresh();
      }
    });
  };

  return (
    <>
      <section aria-label="진행 보드" className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => {
          const list = cards[col.key];
          const droppable = dragging ? canDrop(dragging.card, col) : false;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = droppable ? "move" : "none";
                setOver(col.key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === col.key ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging) move(dragging.card, dragging.from, col);
                setDragging(null);
                setOver(null);
              }}
              className={[
                "flex min-h-[200px] flex-col gap-3 rounded-[24px] border p-4 transition-colors duration-[120ms]",
                dragging && over === col.key ? (droppable ? "border-accent bg-accent-soft" : "border-line bg-surface-sunken") : "border-line bg-surface-subtle",
                dragging && !droppable && over !== col.key ? "opacity-70" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between px-2 py-1">
                <h2 className="m-0 flex items-center gap-2 text-[15px] font-bold">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: col.dot }} />
                  {col.label}
                </h2>
                <span className="text-[13px] font-semibold text-ink-2">{list.length + (col.key === "recommended" ? recommendedMore : 0)}</span>
              </div>
              {list.length ? (
                list.map((c) => (
                  <Card
                    key={c.id}
                    c={c}
                    columns={columns}
                    dragging={dragging?.card.id === c.id}
                    onDragStart={() => setDragging({ card: c, from: col.key })}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onMove={(to) => move(c, col.key, to)}
                  />
                ))
              ) : (
                <p className="m-0 px-2 py-6 text-center text-[13px] text-ink-3">{col.key === "recommended" ? "추천할 공고가 없어요" : "비어 있어요"}</p>
              )}
              {col.key === "recommended" && recommendedMore ? (
                <Link href="/announcements" className="px-2 text-[13px] font-semibold text-accent hover:text-accent-hover">
                  {recommendedMore}개 더 보기
                </Link>
              ) : null}
            </div>
          );
        })}
      </section>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8">
        {toasts.map((t) => (
          <div key={t.id} role={t.ok ? "status" : "alert"} className={`pointer-events-auto rounded-full px-5 py-3 text-[14px] font-semibold shadow-card ${t.ok ? "bg-ink-button text-white" : "bg-[var(--status-review-bg)] text-urgent-text"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

function Card({
  c,
  columns,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  c: BoardCard;
  columns: readonly Column[];
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: Column) => void;
}) {
  const targets = columns.filter((col) => canDrop(c, col));
  const menu = useDismiss();
  const href = c.status === "drafting" || c.status === "review" ? `/applications/${c.id}/draft` : `/announcements/${c.announcementId}`;
  const urgent = c.t.phase === "open" && c.t.urgent;
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", c.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`flex cursor-grab flex-col gap-3.5 rounded-[18px] bg-surface p-[18px] shadow-card active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={href} draggable={false} className="text-[15px] leading-[1.45] font-bold text-ink hover:underline hover:underline-offset-4">
          {c.title}
        </Link>
        {c.score !== null ? <span className={`flex-none text-[15px] font-extrabold ${c.score >= 85 ? "text-accent" : "text-ink-2"}`}>{c.score}</span> : null}
      </div>
      <span className="-mt-1.5 text-[12px] text-ink-3">
        {[c.organization, c.progress ? `초안 ${c.progress.done}/${c.progress.total}` : null].filter(Boolean).join(" · ")}
      </span>
      <div className="flex flex-col gap-1.5">
        <TimelineBar t={c.t} start={null} end={null} label={false} muted={c.status === "submitted" || c.status.startsWith("result")} />
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[12px] font-bold ${urgent ? "text-urgent-text" : "text-ink-2"}`}>{c.dday}</span>
          <div className="flex items-center gap-2">
            {c.openComments ? (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-ink-2" title="해결 안 된 코멘트">
                <MessageSquare size={13} strokeWidth={2.2} aria-hidden="true" />
                {c.openComments}
                <span className="sr-only">개 코멘트 열림</span>
              </span>
            ) : null}
            <span className="flex -space-x-1.5">
              {c.people.map((p) => (
                <span key={p.id} title={p.name ?? p.email ?? ""} className="rounded-full ring-2 ring-surface">
                  <Avatar name={p.name} email={p.email} size={24} />
                </span>
              ))}
            </span>
            {targets.length ? (
              <details ref={menu} className="relative">
                <summary aria-label={`${c.title} 옮기기`} className="flex size-7 cursor-pointer list-none items-center justify-center rounded-full text-ink-3 hover:bg-surface-subtle hover:text-ink [&::-webkit-details-marker]:hidden">
                  <ArrowRightLeft size={14} strokeWidth={2.2} aria-hidden="true" />
                </summary>
                <div className="absolute right-0 z-10 mt-1 flex w-36 flex-col rounded-lg border border-line bg-surface p-1 shadow-card">
                  {targets.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        if (menu.current) menu.current.open = false;
                        onMove(t);
                      }}
                      className="h-9 rounded-md px-3 text-left text-[13px] font-medium text-ink-2 hover:bg-surface-subtle"
                    >
                      {withRo(t.label)} 옮기기
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
