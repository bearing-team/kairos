import { STATUS_STYLE, type ApplicationStatus } from "@/lib/status";

/** h28 알약형 칩 (DESIGN.md StatusChip). 색은 status.ts만 쓴다 */
export function StatusChip({ status, className = "" }: { status: ApplicationStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold whitespace-nowrap ${className}`}
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
