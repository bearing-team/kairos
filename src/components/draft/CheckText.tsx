import Link from "next/link";
import { splitChecks } from "@/lib/needsCheck";

/** 본문 + 【확인 필요】 하이라이트. 누르면 회사 프로필로 (DESIGN.md 4절) */
export function CheckText({ content }: { content: string }) {
  return (
    <div className="text-[15px] leading-[1.75] whitespace-pre-wrap text-ink">
      {splitChecks(content).map((p, i) =>
        p.check ? (
          <Link
            key={i}
            href="/company"
            title="회사 프로필에서 채우기"
            className="rounded-[6px] bg-check-bg px-1 py-0.5 font-semibold text-check-fg no-underline [box-decoration-break:clone] hover:underline"
          >
            {p.text}
          </Link>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </div>
  );
}
