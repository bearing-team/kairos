import { interestedCount, reviewWaitingCount } from "@/server/matches";
import { openReceivedCount } from "@/server/requests";
import { requireUser } from "@/server/session";
import { SidebarNav } from "./SidebarNav";
import { INTERESTED_HREF } from "./nav-items";

/** 사이드바 카운트 배지: 관심 공고 수, 초안·리뷰 = 리뷰 대기 수, 요청 = 나에게 온 진행 중 요청 (DESIGN.md Sidebar) */
export async function SidebarNavWithCounts() {
  const me = await requireUser();
  const [review, interested, requests] = await Promise.all([reviewWaitingCount(), interestedCount(), openReceivedCount(me)]);
  return <SidebarNav counts={{ "/board": review, [INTERESTED_HREF]: interested, "/requests": requests }} />;
}
