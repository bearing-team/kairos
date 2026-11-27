import Link from "next/link";
import { Settings2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";

/** 헤더의 "공고 관리하기": 공고 소스 화면으로 (연결된 소스·뉴스레터 관리, 새 소스 연결, 지금 가져오기) */
export function SourcesButton() {
  return (
    <Link href="/announcements/sources" className={buttonClass("ink", "md", "w-full md:w-auto")}>
      <Settings2 size={16} strokeWidth={2.2} aria-hidden="true" />
      공고 관리하기
    </Link>
  );
}
