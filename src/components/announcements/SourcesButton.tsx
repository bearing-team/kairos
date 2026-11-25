import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

/** 헤더의 "새 공고 가져오기": 공고 소스 화면으로 (게시판 연결·관리, 지금 가져오기) */
export function SourcesButton() {
  return (
    <Link href="/announcements/sources" className={buttonClass("ink", "md", "w-full md:w-auto")}>
      <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
      새 공고 가져오기
    </Link>
  );
}
