import type { ReactNode } from "react";

/** 빈 상태: 일러스트 없이 한 문장 + (선택) 설명 + 행동 버튼 */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[20px] leading-[1.4] font-bold">{title}</h2>
        {description ? <p className="m-0 text-[14px] leading-[1.7] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </section>
  );
}
