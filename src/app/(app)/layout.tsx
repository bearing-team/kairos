import { Sidebar } from "@/components/layout/Sidebar";
import { Suspense } from "react";
import { TriageProvider } from "@/components/announcements/Triage";
import { MobileTabBar, MobileTabBarList } from "@/components/layout/MobileTabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <main className="relative isolate min-w-0 flex-1 px-4 pt-6 pb-24 md:px-12 md:pt-10 md:pb-16">
        <TriageProvider>
          <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-8">{children}</div>
        </TriageProvider>
      </main>
      <Suspense fallback={<MobileTabBarList pathname={null} />}>
        <MobileTabBar />
      </Suspense>
    </div>
  );
}
