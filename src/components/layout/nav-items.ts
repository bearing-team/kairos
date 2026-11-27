import { BriefcaseBusiness, Clock3, FileText, House, List, Star, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string; // 모바일 하단 탭바용
  icon: LucideIcon;
  inTabBar: boolean;
};

/** 관심 공고 = 공고 목록의 관심 탭 (따로 화면을 두지 않는다) */
export const INTERESTED_HREF = "/announcements?status=interested";

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", shortLabel: "홈", icon: House, inTabBar: true },
  { href: "/announcements", label: "전체 공고", shortLabel: "공고", icon: List, inTabBar: true },
  { href: INTERESTED_HREF, label: "관심 공고", shortLabel: "관심", icon: Star, inTabBar: false },
  { href: "/board", label: "초안·리뷰", shortLabel: "보드", icon: FileText, inTabBar: true },
  { href: "/history", label: "지원 이력", shortLabel: "이력", icon: Clock3, inTabBar: false },
  { href: "/company", label: "회사 프로필", shortLabel: "프로필", icon: BriefcaseBusiness, inTabBar: true },
];

/** status는 현재 주소의 ?status= (관심 공고와 전체 공고를 가르는 데만 쓴다) */
export function isActive(pathname: string, href: string, status?: string | null) {
  if (href === INTERESTED_HREF) return pathname === "/announcements" && status === "interested";
  if (href === "/announcements" && pathname === href && status === "interested") return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
