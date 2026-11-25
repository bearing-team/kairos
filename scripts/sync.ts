// pnpm sync [bizinfo|kstartup|boards] — 공고 소싱 1회 실행 (생략하면 전부)
import "dotenv/config";
import { API_SOURCES, SOURCE_LABEL, syncAll, type ApiSource } from "@/server/sources/sync";
import { prisma } from "@/server/db";
import { describeMatch, matchAfterSync } from "@/server/matching/pipeline";
import { checkAllBoards } from "@/server/sources/boards";

async function main() {
  const arg = process.argv[2];
  if (arg && arg !== "boards" && !API_SOURCES.includes(arg as ApiSource)) throw new Error(`알 수 없는 소스: ${arg} (${[...API_SOURCES, "boards"].join(", ")})`);
  const results = arg === "boards" ? [] : await syncAll(arg ? [arg as ApiSource] : API_SOURCES);
  for (const r of results) {
    const label = SOURCE_LABEL[r.source];
    if (r.skipped) console.log(`- ${label}: 건너뜀 (${r.error})`);
    else if (r.ok) console.log(`✓ ${label}: ${r.fetched}건 받음 · 새 공고 ${r.created} · 변경 ${r.updated}`);
    else console.log(`✗ ${label}: 실패 — ${r.error}`);
  }
  const boards = !arg || arg === "boards" ? await checkAllBoards() : [];
  for (const r of boards) console.log(`${r.ok ? "✓" : r.skipped ? "-" : "✗"} 게시판 ${r.name}: ${r.ok ? r.note : r.error ?? r.note}`);
  if (results.every((r) => !r.ok) && !boards.some((r) => r.ok)) {
    process.exitCode = 1;
    return;
  }
  console.log(`→ ${describeMatch(await matchAfterSync())}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
