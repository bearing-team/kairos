"use client";

import { Download } from "lucide-react";
import { useDismiss } from "@/components/ui/useDismiss";

/** 내보내기 (F5.4): DOCX·Markdown은 파일, PDF는 인쇄용 화면 → 브라우저 "PDF로 저장". 양식 채우기 초안은 원본 HWP에 값을 넣어서 */
export function ExportMenu({ draftId, checks, hwp = false }: { draftId: string; checks: number; hwp?: boolean }) {
  const menu = useDismiss();
  const item = "flex h-10 items-center rounded-md px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-subtle";
  return (
    <details ref={menu} className="relative">
      <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-full bg-surface-subtle px-5 text-[14px] font-semibold text-ink-2 hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">
        <Download size={16} strokeWidth={2.2} aria-hidden="true" />
        내보내기
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-60 flex-col rounded-lg border border-line bg-surface p-1 shadow-card">
        {checks ? <p className="m-0 px-3 py-2 text-[12px] leading-[1.5] text-check-fg">확인 필요 {checks}곳이 남아 있어요. 표시는 그대로 들어가요.</p> : null}
        {hwp ? (
          <a href={`/api/drafts/${draftId}/export?format=hwp`} className={`${item} font-semibold text-ink`}>
            한/글 양식 (.hwp) · 칸을 채운 원본 양식
          </a>
        ) : null}
        <a href={`/api/drafts/${draftId}/export?format=docx`} className={item}>
          Word 문서 (.docx)
        </a>
        <a href={`/print/drafts/${draftId}`} target="_blank" rel="noreferrer" className={item}>
          PDF (인쇄 화면에서 저장)
        </a>
        <a href={`/api/drafts/${draftId}/export?format=md`} className={item}>
          Markdown (.md)
        </a>
      </div>
    </details>
  );
}
