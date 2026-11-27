// 요청 줄 → 화면용 값 (서버 컴포넌트에서 만들어 클라이언트에 넘긴다)
import { formatKstRelative } from "@/lib/format";
import { kstYmd } from "@/lib/kst";
import { requestHref, type RequestKind, type RequestStatus } from "@/lib/requests";
import type { RequestRow } from "@/server/requests";

export type RequestView = {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  message: string;
  reply: string | null;
  title: string;
  href: string;
  sectionTitle: string | null;
  from: { id: string; name: string | null; email: string | null };
  to: { id: string; name: string | null; email: string | null };
  created: string;
  responded: string | null;
  due: { label: string; urgent: boolean; overdue: boolean } | null;
  role: "to" | "from" | "other";
};

const DAY = 86_400_000;
const dayNo = (d: Date) => {
  const { year, month, day } = kstYmd(d);
  return Math.round(Date.UTC(year, month - 1, day) / DAY);
};
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function dueLabel(dueAt: Date, now: Date) {
  const { month, day, year } = kstYmd(dueAt);
  const w = WEEK[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const left = dayNo(dueAt) - dayNo(now);
  const rel = left < 0 ? `${-left}일 지남` : left === 0 ? "오늘까지" : left === 1 ? "내일까지" : `D-${left}`;
  return {
    label: `${month}.${String(day).padStart(2, "0")}(${w}) · ${rel}`,
    urgent: left <= 1,
    overdue: left < 0,
  };
}

export function toRequestView(r: RequestRow, meId: string, now: Date): RequestView {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    message: r.message,
    reply: r.reply,
    title: r.application.announcement.title,
    href: requestHref(r.applicationId, r.section),
    sectionTitle: r.sectionTitle,
    from: r.from,
    to: r.to,
    created: formatKstRelative(r.createdAt, now),
    responded: r.respondedAt ? formatKstRelative(r.respondedAt, now) : null,
    due: r.dueAt && r.status === "open" ? dueLabel(r.dueAt, now) : null,
    role: r.to.id === meId ? "to" : r.from.id === meId ? "from" : "other",
  };
}
