// pnpm draft <공고 id | 진행(application) id> — 첨부를 받아 초안 새 버전을 만든다 (상태는 바꾸지 않음)
import "dotenv/config";
import { prisma } from "@/server/db";
import { getCompany } from "@/server/company";
import { createDraft, runDraft } from "@/server/drafting/run";
import { llmConfigured } from "@/server/llm";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("사용법: pnpm draft <공고 id 또는 application id>");
  const company = await getCompany();
  const app =
    (await prisma.application.findUnique({ where: { id }, select: { id: true } })) ??
    (await prisma.application.findUnique({ where: { announcementId_companyId: { announcementId: id, companyId: company.id } }, select: { id: true } }));
  if (!app) throw new Error("해당 공고의 진행 정보가 없어요 (pnpm score로 매칭부터)");

  const { id: draftId, created } = await createDraft(app.id, null);
  if (!created) throw new Error("이미 만드는 중인 초안이 있어요");
  console.log(`초안 ${draftId} 만드는 중 (LLM ${llmConfigured() ? "있음" : "없음 → 섹션만"})`);
  const t0 = Date.now();
  await runDraft(draftId);

  const d = await prisma.draft.findUniqueOrThrow({
    where: { id: draftId },
    include: { sections: { orderBy: { order: "asc" } }, application: { select: { requiredDocs: true, announcement: { select: { title: true, attachments: true } } } } },
  });
  console.log(`\n${d.application.announcement.title} — v${d.version} ${d.status} (${Math.round((Date.now() - t0) / 1000)}초, ${d.templateSource})`);
  if (d.error) console.log(`오류: ${d.error}`);
  for (const n of d.notes) console.log(`메모: ${n}`);
  console.log("\n첨부:");
  for (const a of d.application.announcement.attachments) console.log(`  [${a.kind}] ${a.fileName} — ${a.parseStatus}${a.parseError ? ` (${a.parseError})` : ""}`);
  console.log("\n섹션:");
  for (const s of d.sections) console.log(`  ${s.order + 1}. ${s.title} — ${s.status} ${s.content.length}자${s.limitChars ? `/${s.limitChars}` : ""} · 확인 필요 ${s.needsCheck.length}${s.error ? ` (${s.error})` : ""}`);
  if (d.criteria.length) console.log(`\n평가 기준: ${d.criteria.join(" / ")}`);
  if (d.application.requiredDocs.length) console.log(`제출 서류: ${d.application.requiredDocs.map((r) => r.name).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
