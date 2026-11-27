// 진행 상태 → 표기·색. 컴포넌트는 이 맵만 쓴다 (DESIGN.md 3절, PRD 5절)
export const APPLICATION_STATUSES = [
  "new",
  "triage",
  "interested",
  "drafting",
  "review",
  "submitted",
  "result_pass",
  "result_fail",
  "excluded",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

type StatusStyle = { label: string; bg: string; fg: string; dot: string; dimmed?: boolean };

export const STATUS_STYLE: Record<ApplicationStatus, StatusStyle> = {
  new: { label: "새 공고", bg: "var(--status-new-bg)", fg: "var(--status-new-fg)", dot: "var(--status-new-dot)" },
  triage: { label: "검토 전", bg: "var(--status-triage-bg)", fg: "var(--status-triage-fg)", dot: "var(--status-triage-dot)" },
  interested: { label: "관심", bg: "var(--status-interested-bg)", fg: "var(--status-interested-fg)", dot: "var(--status-interested-dot)" },
  drafting: { label: "초안 작성 중", bg: "var(--status-drafting-bg)", fg: "var(--status-drafting-fg)", dot: "var(--status-drafting-dot)" },
  review: { label: "리뷰 중", bg: "var(--status-review-bg)", fg: "var(--status-review-fg)", dot: "var(--status-review-dot)" },
  submitted: { label: "제출 완료", bg: "var(--status-submitted-bg)", fg: "var(--status-submitted-fg)", dot: "var(--status-submitted-dot)" },
  result_pass: { label: "선정", bg: "var(--status-submitted-bg)", fg: "var(--status-submitted-fg)", dot: "var(--status-submitted-dot)" },
  result_fail: { label: "미선정", bg: "var(--status-excluded-bg)", fg: "var(--status-excluded-fg)", dot: "var(--status-excluded-dot)" },
  excluded: { label: "제외", bg: "var(--status-excluded-bg)", fg: "var(--status-excluded-fg)", dot: "var(--status-excluded-dot)", dimmed: true },
};
