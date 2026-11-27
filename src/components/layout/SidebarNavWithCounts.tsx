import { connection } from "next/server";
import { interestedCount, reviewWaitingCount } from "@/server/matches";
import { SidebarNav } from "./SidebarNav";
import { INTERESTED_HREF } from "./nav-items";

/** 사이드바 카운트 배지: 관심 공고 수, 초안·리뷰 = 리뷰 대기 수 (DESIGN.md Sidebar) */
export async function SidebarNavWithCounts() {
  await connection();
  const [review, interested] = await Promise.all([reviewWaitingCount(), interestedCount()]);
  return <SidebarNav counts={{ "/board": review, [INTERESTED_HREF]: interested }} />;
}
