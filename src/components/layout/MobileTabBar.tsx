"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "./nav-items";

/** <768: 사이드바 대신 하단 탭바 (홈/공고/보드/프로필) */
export function MobileTabBar() {
  return <MobileTabBarList pathname={usePathname()} />;
}

export function MobileTabBarList({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_ITEMS.filter((i) => i.inTabBar).map(({ href, shortLabel, icon: Icon }) => {
        const active = pathname !== null && isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[12px]",
              active ? "font-semibold text-accent" : "font-medium text-ink-3",
            ].join(" ")}
          >
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
            {shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
