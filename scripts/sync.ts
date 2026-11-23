// pnpm sync [bizinfo|kstartup] — 공고 소싱 1회 실행
import "dotenv/config";
import { API_SOURCES, SOURCE_LABEL, syncAll, type ApiSource } from "@/server/sources/sync";
import { prisma } from "@/server/db";

async function main() {
  const arg = process.argv[2] as ApiSource | undefined;
  if (arg && !API_SOURCES.includes(arg)) throw new Error(`알 수 없는 소스: ${arg} (${API_SOURCES.join(", ")})`);
  const results = await syncAll(arg ? [arg] : API_SOURCES);
  for (const r of results) {
    const label = SOURCE_LABEL[r.source];
    if (r.skipped) console.log(`- ${label}: 건너뜀 (${r.error})`);
    else if (r.ok) console.log(`✓ ${label}: ${r.fetched}건 받음 · 새 공고 ${r.created} · 변경 ${r.updated}`);
    else console.log(`✗ ${label}: 실패 — ${r.error}`);
  }
  if (results.every((r) => !r.ok)) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
