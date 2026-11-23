// 초안 내보내기 (F5.4). 문서 모양만 만든다 — DB 없음, 테스트 가능
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { splitChecks } from "@/lib/needsCheck";

export type ExportDoc = {
  title: string;
  company: string;
  version: number;
  date: string; // "2026-11-23"
  sections: { title: string; content: string }[];
};

export function exportFileName(d: ExportDoc, ext: string) {
  const base = `${d.title}_사업계획서_초안_v${d.version}`.replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${base}.${ext}`;
}

export function toMarkdown(d: ExportDoc): string {
  const out = [`# ${d.title}`, "", `${d.company} · 사업계획서 초안 v${d.version} · ${d.date}`, ""];
  for (const s of d.sections) out.push(`## ${s.title}`, "", s.content.trim() || "(비어 있음)", "");
  return out.join("\n");
}

const FONT = "맑은 고딕";

/** 한 줄 → 문단. "- "로 시작하면 글머리 목록, 【확인 필요】는 노란 형광 */
function lineToParagraph(line: string): Paragraph {
  const bullet = /^\s*[-•·]\s+/.test(line);
  const text = bullet ? line.replace(/^\s*[-•·]\s+/, "") : line;
  const runs = splitChecks(text).map(
    (p) => new TextRun({ text: p.text, font: FONT, size: 22, ...(p.check ? { highlight: "yellow", bold: true } : {}) }),
  );
  return new Paragraph({ children: runs, spacing: { after: 80, line: 360 }, ...(bullet ? { bullet: { level: 0 } } : {}) });
}

export async function toDocx(d: ExportDoc): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT, children: [new TextRun({ text: d.title, font: FONT, bold: true, size: 36 })] }),
    new Paragraph({ spacing: { after: 320 }, children: [new TextRun({ text: `${d.company} · 사업계획서 초안 v${d.version} · ${d.date}`, font: FONT, size: 20, color: "6B7183" })] }),
  ];
  d.sections.forEach((s, i) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 }, children: [new TextRun({ text: `${i + 1}. ${s.title}`, font: FONT, bold: true, size: 28 })] }));
    const lines = s.content.split("\n").filter((l, idx, arr) => l.trim() || (idx > 0 && arr[idx - 1].trim()));
    if (!lines.length) children.push(new Paragraph({ children: [new TextRun({ text: "(비어 있음)", font: FONT, size: 22, color: "9AA0AE" })] }));
    for (const l of lines) children.push(lineToParagraph(l));
  });
  const doc = new Document({
    creator: d.company,
    title: d.title,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1300, right: 1300 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
