import { Suspense } from "react";
import { LogoMark } from "./LogoMark";
import { SidebarNav, SidebarNavList } from "./SidebarNav";
import { CompanyCard, CompanyCardSkeleton } from "./CompanyCard";
import { UserMenu } from "./UserMenu";

/** ≥1200 전체 / 768~1199 아이콘만(72) / <768 숨김(하단 탭바) */
export function Sidebar() {
  return (
    <nav
      aria-label="주 메뉴"
      className="sticky top-0 hidden h-dvh w-[72px] flex-none flex-col gap-6 border-r border-line bg-surface px-3 py-7 md:flex xl:w-[var(--sidebar-w)] xl:px-4"
    >
      <div className="flex items-center justify-center gap-3 xl:justify-start xl:px-2">
        <LogoMark />
        <div className="hidden flex-col gap-0.5 xl:flex">
          <span className="text-[15px] font-bold leading-[1.4]">지원사업 데스크</span>
          <span className="text-[12px] leading-[1.4] text-ink-3">베어링 내부 툴</span>
        </div>
      </div>

      <Suspense fallback={<SidebarNavList pathname={null} />}>
        <SidebarNav />
      </Suspense>

      <div className="mt-auto hidden flex-col gap-4 xl:flex">
        <Suspense fallback={<CompanyCardSkeleton />}>
          <CompanyCard />
        </Suspense>
        <Suspense fallback={null}>
          <UserMenu />
        </Suspense>
      </div>
    </nav>
  );
}
