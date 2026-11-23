import { connection } from "next/server";
import { auth } from "@/auth";
import { reviewWaitingCount } from "@/server/matches";
import { SidebarNav } from "./SidebarNav";

/** 사이드바 카운트 배지: 초안·리뷰 = 리뷰 대기 수 (DESIGN.md Sidebar) */
export async function SidebarNavWithCounts() {
  await connection();
  const session = await auth();
  const review = session?.user ? await reviewWaitingCount() : 0;
  return <SidebarNav counts={review ? { "/board": review } : {}} />;
}
