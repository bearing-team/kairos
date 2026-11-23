import type { ReactNode } from "react";

/** 페이지 상단: 위 작은 줄(14, 흐림) + H1(36/800) + 오른쪽 행동 */
export function PageHeader({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        {eyebrow ? <span className="text-[14px] text-ink-3">{eyebrow}</span> : null}
        <h1 className="m-0 text-[28px] leading-[1.3] font-extrabold tracking-[-0.03em] md:text-[36px]">{title}</h1>
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 md:w-auto">{actions}</div> : null}
    </header>
  );
}

export function PageHeaderSkeleton() {
  return (
    <header className="flex flex-col gap-3" aria-hidden="true">
      <span className="h-5 w-48 animate-pulse rounded-full bg-track" />
      <span className="h-11 w-96 max-w-full animate-pulse rounded-full bg-track" />
    </header>
  );
}
