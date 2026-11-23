import { BriefcaseBusiness, Clock3, FileText, House, List, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string; // 모바일 하단 탭바용
  icon: LucideIcon;
  inTabBar: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", shortLabel: "홈", icon: House, inTabBar: true },
  { href: "/announcements", label: "전체 공고", shortLabel: "공고", icon: List, inTabBar: true },
  { href: "/board", label: "초안·리뷰", shortLabel: "보드", icon: FileText, inTabBar: true },
  { href: "/history", label: "지원 이력", shortLabel: "이력", icon: Clock3, inTabBar: false },
  { href: "/company", label: "회사 프로필", shortLabel: "프로필", icon: BriefcaseBusiness, inTabBar: true },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
