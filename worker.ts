// pg-boss 워커 엔트리: pnpm worker
import "dotenv/config";
import { ensureSecrets } from "@/server/secrets";
import PgBoss from "pg-boss";
import { QUEUES, SCHEDULES, TZ } from "@/server/jobs/queues";
import { SOURCE_LABEL, syncSource, type ApiSource } from "@/server/sources/sync";
import { describeMatch, matchAfterSync } from "@/server/matching/pipeline";
import { checkAllBoards } from "@/server/sources/boards";
import { describeSend, sendDeadlineAlerts, sendDigest } from "@/server/notify/run";

async function main() {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
  boss.on("error", (e) => console.error("[pg-boss]", e));
  await boss.start();

  for (const q of Object.values(QUEUES)) await boss.createQueue(q);
  // 작업마다 화면에서 넣은 연결 키를 다시 읽는다 (웹에서 바꾼 키가 워커를 재시작하지 않아도 반영되게)
  const work = (queue: string, fn: () => Promise<void>) =>
    boss.work(queue, async () => {
      await ensureSecrets(true);
      await fn();
    });
  for (const s of SCHEDULES) await boss.schedule(s.queue, s.cron, {}, { tz: TZ });

  const syncHandler = (source: ApiSource) => async () => {
    const r = await syncSource(source);
    const label = SOURCE_LABEL[source];
    if (r.ok) console.log(`[sync] ${label}: ${r.fetched}건, 새 ${r.created}, 변경 ${r.updated}`);
    else console.log(`[sync] ${label}: ${r.skipped ? "건너뜀" : "실패"} — ${r.error}`);
    if (r.ok) console.log(`[match] ${describeMatch(await matchAfterSync())}`);
  };
  await work(QUEUES.syncBizinfo, syncHandler("bizinfo"));
  await work(QUEUES.syncKstartup, syncHandler("kstartup"));
  await work(QUEUES.syncBoards, async () => {
    const rs = await checkAllBoards();
    for (const r of rs) console.log(`[board] ${r.name}: ${r.ok ? r.note : r.skipped ? `건너뜀 — ${r.note}` : `실패 — ${r.error}`}`);
    if (rs.some((r) => r.created)) console.log(`[match] ${describeMatch(await matchAfterSync())}`);
  });
  // 점수 대기분을 조금씩 소화 (한 번에 SCORE_MAX_PER_RUN개)
  await work(QUEUES.scorePending, async () => {
    console.log(`[score] ${describeMatch(await matchAfterSync())}`);
  });

  await work(QUEUES.notifyDigest, async () => console.log(`[digest] ${describeSend(await sendDigest())}`));
  await work(QUEUES.notifyDeadline, async () => console.log(`[deadline] ${describeSend(await sendDeadlineAlerts())}`));

  console.log(`워커 시작: ${SCHEDULES.map((s) => `${s.queue}@${s.cron}`).join(", ")} (${TZ})`);

  const shutdown = async () => {
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
