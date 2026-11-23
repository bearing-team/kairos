// pg-boss 큐 이름과 일정. 일정은 KST 기준 (ARCHITECTURE.md 1절)
export const QUEUES = {
  syncBizinfo: "sync-bizinfo",
  syncKstartup: "sync-kstartup",
} as const;

export const SCHEDULES: { queue: string; cron: string }[] = [
  { queue: QUEUES.syncBizinfo, cron: "0 8 * * *" }, // 매일 08:00
  { queue: QUEUES.syncKstartup, cron: "5 8 * * *" }, // 매일 08:05
];

export const TZ = "Asia/Seoul";
