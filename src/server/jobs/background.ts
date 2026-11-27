import "server-only";
import { after } from "next/server";
import PgBoss from "pg-boss";
import { QUEUES } from "./queues";
import { describeJob, runJob, type BackgroundJob } from "./handlers";

/**
 * 응답 뒤에 할 일을 맡긴다.
 * - 기본(로컬): 웹 프로세스의 after()에서 바로 실행
 * - BACKGROUND_JOBS=queue (Amplify): 서버리스라 응답 뒤 작업이 보장되지 않는다 → pg-boss 큐에 넣고 워커가 처리
 */
export async function runInBackground(job: BackgroundJob): Promise<void> {
  if (queueMode()) {
    const boss = await webBoss();
    // 초안은 섹션이 많으면 오래 걸린다 → 넉넉히
    await boss.send(QUEUES.background, job, { expireInMinutes: job.kind.startsWith("draft") ? 60 : 15, retryLimit: 0 });
    return;
  }
  after(() => runJob(job).catch((e) => console.error(`[background] ${describeJob(job)}`, e)));
}

const queueMode = () => process.env.BACKGROUND_JOBS?.trim() === "queue";

// 보내기만 하는 pg-boss: 일정·유지보수는 워커가 맡는다
const g = globalThis as unknown as { webBoss?: Promise<PgBoss> };
function webBoss(): Promise<PgBoss> {
  g.webBoss ??= (async () => {
    const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss", max: 2, supervise: false, schedule: false });
    boss.on("error", (e) => console.error("[pg-boss]", e));
    await boss.start();
    await boss.createQueue(QUEUES.background);
    return boss;
  })().catch((e) => {
    g.webBoss = undefined;
    throw e;
  });
  return g.webBoss;
}
