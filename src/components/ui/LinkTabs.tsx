import Link from "next/link";

/** 세그먼트 탭 모양의 링크 탭 (URL로 상태 유지) */
export function LinkTabs({ items, current, label }: { items: { key: string; label: string; href: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-surface-sunken p-1">
      {items.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex h-9 items-center rounded-full px-4 text-[14px] whitespace-nowrap transition-colors duration-[200ms]",
              active ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-ink-2 hover:text-ink",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
