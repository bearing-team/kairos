// pnpm score [개수|all] — 하드필터를 다시 돌리고 점수 대기 공고를 매긴다 (기본 SCORE_MAX_PER_RUN, 30)
import "dotenv/config";
import { prisma } from "@/server/db";
import { describeMatch } from "@/server/matching/pipeline";
import { refreshMatches, scorePending } from "@/server/matching/run";

async function main() {
  const arg = process.argv[2];
  const limit = arg === "all" ? 100_000 : arg ? Number(arg) : undefined;
  if (limit !== undefined && !(limit >= 0)) throw new Error("개수는 숫자 또는 all");
  const refresh = await refreshMatches();
  const score = await scorePending({ limit });
  console.log(describeMatch({ refresh, score }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
