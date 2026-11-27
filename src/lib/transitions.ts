// 상태 전이 규칙 (ARCHITECTURE.md 3절). 서버 액션이 이걸로 검증하고, 화면은 가능한 버튼만 보여 준다
import type { ApplicationStatus } from "./status";

const NEXT: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ["interested", "triage", "drafting"],
  triage: ["interested", "drafting"],
  interested: ["drafting", "triage"], // triage = 관심 해제
  drafting: ["review", "interested", "triage"],
  review: ["submitted", "drafting"],
  submitted: ["result_pass", "result_fail", "review"],
  result_pass: ["submitted"],
  result_fail: ["submitted"],
  excluded: ["triage", "interested"], // 다시 검토하기 · 1차 분류 되돌리기
};

/** 제외는 어느 단계에서든 가능(사유 필수). 결과까지 나온 건은 제외하지 않는다 */
const EXCLUDABLE = new Set<ApplicationStatus>(["new", "triage", "interested", "drafting", "review", "submitted"]);

export function allowedNext(from: ApplicationStatus): ApplicationStatus[] {
  return [...NEXT[from], ...(EXCLUDABLE.has(from) ? (["excluded"] as const) : [])];
}

export type TransitionCheck = { ok: true } | { ok: false; error: string };

export function checkTransition(from: ApplicationStatus, to: ApplicationStatus, reason?: string | null): TransitionCheck {
  if (from === to) return { ok: false, error: "이미 그 상태예요" };
  if (!allowedNext(from).includes(to)) return { ok: false, error: "이 단계에서는 그 상태로 바꿀 수 없어요" };
  if (to === "excluded" && !reason?.trim()) return { ok: false, error: "제외 사유를 적어 주세요" };
  return { ok: true };
}

/** 상태별 주요 행동 (DESIGN.md FocusHeroCard·상세 패널) */
export const PRIMARY_ACTION: Partial<Record<ApplicationStatus, { to: ApplicationStatus; label: string }>> = {
  new: { to: "drafting", label: "초안 만들기" },
  triage: { to: "drafting", label: "초안 만들기" },
  interested: { to: "drafting", label: "초안 만들기" },
  drafting: { to: "review", label: "리뷰 요청하기" },
  review: { to: "submitted", label: "제출 완료로 표시" },
  excluded: { to: "triage", label: "다시 검토하기" },
};

/** "진행 중" 탭·카운트에 들어가는 상태 */
export const IN_PROGRESS: ApplicationStatus[] = ["triage", "interested", "drafting", "review"];
/** 1차 분류 전 (공고 목록 "분류 전" 탭). 여기서 관심 / 관심 없음(제외)으로 나눈다 */
export const UNSORTED: ApplicationStatus[] = ["new", "triage"];
/** 홈 히어로 후보 (ARCHITECTURE.md 5.3) */
export const HERO_STATUSES: ApplicationStatus[] = ["new", "triage", "interested", "drafting"];
/** "이번 주에 챙길 공고" 대상 상태 */
export const FOCUS_STATUSES: ApplicationStatus[] = ["new", "interested", "drafting", "review"];
