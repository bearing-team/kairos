// 양식 파싱 성공률 측정: fixtures/forms/manifest.tsv의 파일을 모두 파싱해 표로 출력
// pnpm tsx scripts/measure-forms.ts [--dump 01]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "../src/server/docs";

const dir = join(process.cwd(), "fixtures/forms");
const dump = process.argv.includes("--dump") ? process.argv[process.argv.indexOf("--dump") + 1] : null;
const rows = readFileSync(join(dir, "manifest.tsv"), "utf8").trim().split("\n").slice(1).map((l) => l.split("\t"));
const HEADING = /^(?:[0-9]{1,2}[.)]\s|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ][.\s]|[□■◎○●▣◆◇]\s?|[가-하][.)]\s|<[^>]{2,30}>$|【[^】]+】$)/;

async function main() {
console.log("no\tformat\tms\tchars\tblocks\ttables\theadings\tresult");
for (const [no, , , file, name] of rows) {
  const t0 = performance.now();
  try {
    const buf = new Uint8Array(readFileSync(join(dir, file)));
    const doc = await parseDocument(buf, name);
    const ms = Math.round(performance.now() - t0);
    const lines = doc.text.split("\n");
    const headings = lines.filter((l) => HEADING.test(l.trim())).length;
    const tables = doc.blocks.filter((b) => b.type === "table").length;
    console.log([no, doc.format, ms, doc.text.length, doc.blocks.length, tables, headings, "ok"].join("\t"));
    if (dump === no) writeFileSync(join(dir, `${no}.txt`), doc.text);
  } catch (e) {
    console.log([no, "-", Math.round(performance.now() - t0), 0, 0, 0, 0, `FAIL ${e instanceof Error ? e.message : e}`].join("\t"));
  }
}
}

main();
