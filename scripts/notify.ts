// pnpm notify <digest|deadline> [--dry-run]
//   digest   주간 다이제스트를 지금 보낸다 (수동 발송이라 같은 주 중복 방지에 걸리지 않음)
//   deadline 오늘 보낼 마감 알림(D-7/D-3/D-1)을 보낸다 (이미 보낸 구간은 빼고)
//   --dry-run  보내지 않고 메시지만 출력
import "dotenv/config";
import { ensureSecrets } from "@/server/secrets";
import { prisma } from "@/server/db";
import { describeSend, sendDeadlineAlerts, sendDigest } from "@/server/notify/run";

async function main() {
  await ensureSecrets(true); // 화면에서 넣은 연결 키
  const kind = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (kind !== "digest" && kind !== "deadline") throw new Error("사용법: pnpm notify <digest|deadline> [--dry-run]");
  const r = kind === "digest" ? await sendDigest({ dryRun, manual: true }) : await sendDeadlineAlerts({ dryRun, manual: true });
  if (r.text) console.log(`${r.text}\n`);
  console.log(`→ ${describeSend(r)}`);
  if (!r.sent && r.reason === "error") process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
