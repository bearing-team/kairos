// pg-boss 큐 이름과 일정. 일정은 KST 기준 (ARCHITECTURE.md 1절)
export const QUEUES = {
  syncBizinfo: "sync-bizinfo",
  syncKstartup: "sync-kstartup",
  scorePending: "score-pending",
} as const;

export const SCHEDULES: { queue: string; cron: string }[] = [
  { queue: QUEUES.syncBizinfo, cron: "0 8 * * *" }, // 매일 08:00
  { queue: QUEUES.syncKstartup, cron: "5 8 * * *" }, // 매일 08:05
  { queue: QUEUES.scorePending, cron: "30 9-18 * * 1-5" }, // 평일 09:30~18:30 매시, 남은 점수 대기분
];

export const TZ = "Asia/Seoul";
