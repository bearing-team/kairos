// pnpm boards:refill — 접수 기간이 비어 있는 게시판 공고를 다시 읽어(본문에 없으면 공고문 첨부까지) 빈 칸만 채운다
import "dotenv/config";
import { ensureSecrets } from "@/server/secrets";
import { prisma } from "@/server/db";
import { llmConfigured } from "@/server/llm";
import { extractFromUrl } from "@/server/sources/manual";
import { parseKstDate } from "@/server/sources/dates";
import { refreshMatches } from "@/server/matching/run";

async function main() {
  await ensureSecrets(true);
  if (!llmConfigured()) throw new Error("ANTHROPIC_API_KEY가 필요해요");
  const rows = await prisma.announcement.findMany({
    where: { source: "board", applyStart: null, applyEnd: null, url: { not: null } },
    select: { id: true, title: true, url: true, applyPeriodText: true, summary: true, target: true, supportAmountText: true },
  });
  const changed: string[] = [];
  for (const a of rows) {
    const ex = await extractFromUrl(a.url!);
    const f = ex.fields;
    if (!f) {
      console.log(`✗ ${a.title} · ${ex.note ?? "정리 실패"}`);
      continue;
    }
    const data = {
      applyStart: parseKstDate(f.applyStart),
      applyEnd: parseKstDate(f.applyEnd),
      ...(a.applyPeriodText ? {} : { applyPeriodText: f.applyPeriodText }),
      ...(a.summary ? {} : { summary: f.summary }),
      ...(a.target ? {} : { target: f.target }),
      ...(a.supportAmountText ? {} : { supportAmountText: f.supportAmountText }),
    };
    await prisma.announcement.update({ where: { id: a.id }, data });
    if (data.applyStart || data.applyEnd) changed.push(a.id);
    console.log(`${data.applyEnd || data.applyStart ? "✓" : "–"} ${a.title} · ${f.applyPeriodText ?? "기간 없음"}${ex.note ? ` · ${ex.note}` : ""}`);
  }
  if (changed.length) await refreshMatches({ announcementIds: changed });
  console.log(`${rows.length}건 중 ${changed.length}건 기간 채움`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
