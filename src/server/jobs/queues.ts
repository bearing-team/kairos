// pg-boss 큐 이름과 일정. 일정은 KST 기준 (ARCHITECTURE.md 1절)
export const QUEUES = {
  syncBizinfo: "sync-bizinfo",
  syncKstartup: "sync-kstartup",
  syncBoards: "sync-boards",
  scorePending: "score-pending",
  notifyDigest: "notify-digest",
  notifyDeadline: "notify-deadline",
} as const;

export const SCHEDULES: { queue: string; cron: string }[] = [
  { queue: QUEUES.syncBizinfo, cron: "0 8 * * *" }, // 매일 08:00
  { queue: QUEUES.syncKstartup, cron: "5 8 * * *" }, // 매일 08:05
  { queue: QUEUES.syncBoards, cron: "10 8 * * *" }, // 매일 08:10 직접 연결한 게시판
  { queue: QUEUES.scorePending, cron: "30 9-18 * * 1-5" }, // 평일 09:30~18:30 매시, 남은 점수 대기분
  { queue: QUEUES.notifyDigest, cron: "0 9 * * 1" }, // 월요일 09:00 주간 다이제스트 (PRD F6.1)
  { queue: QUEUES.notifyDeadline, cron: "5 9 * * *" }, // 매일 09:05 마감 알림 D-7/D-3/D-1 (PRD F6.2)
];

export const TZ = "Asia/Seoul";
