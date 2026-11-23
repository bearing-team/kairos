"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-10 flex-none rounded-full bg-accent px-5 text-[14px] font-bold text-white hover:bg-accent-hover">
      인쇄 · PDF로 저장
    </button>
  );
}
