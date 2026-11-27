"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";

type Props = { counts?: Partial<Record<string, number>> };

export function SidebarNav(props: Props) {
  const status = useSearchParams().get("status");
  return <SidebarNavList {...props} pathname={usePathname()} status={status} />;
}

/** pathname이 null이면 활성 표시 없이 그린다 (Suspense 대체 화면용) */
export function SidebarNavList({ counts = {}, pathname, status }: Props & { pathname: string | null; status?: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href, status);
        const count = counts[href];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={[
              "flex h-11 items-center gap-3 rounded-md px-3 text-[14px] transition-colors duration-[120ms] ease-brand",
              "justify-center xl:justify-start",
              active ? "bg-accent-soft font-semibold text-accent" : "font-medium text-ink-2 hover:bg-surface-subtle",
            ].join(" ")}
          >
            <Icon size={18} strokeWidth={2} aria-hidden="true" className="flex-none" />
            <span className="hidden flex-1 xl:inline">{label}</span>
            {count ? (
              <span className="hidden h-[22px] min-w-[22px] items-center justify-center rounded-full bg-chip px-1.5 text-[12px] font-semibold text-ink-2 xl:flex">
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
