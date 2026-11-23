// DOCX (Word 2007+, zip + XML)
import { strFromU8, unzipSync } from "fflate";
import { clean, DocParseError, type DocBlock } from "./types";
import { kids, parseXml, tagOf, type XNode } from "./xml";

function runText(nodes: XNode[]): string {
  let s = "";
  for (const n of nodes) {
    const t = tagOf(n);
    if (t === "#text") s += String(n["#text"]);
    else if (t === "w:t") s += runText(kids(n));
    else if (t === "w:tab") s += "\t";
    else if (t === "w:br" || t === "w:cr") s += "\n";
    else if (["w:r", "w:hyperlink", "w:smartTag", "w:ins", "w:sdt", "w:sdtContent", "w:fldSimple"].includes(t)) s += runText(kids(n));
  }
  return s;
}

function cellText(tc: XNode): string {
  const parts: string[] = [];
  for (const n of kids(tc)) {
    if (tagOf(n) === "w:p") parts.push(clean(runText(kids(n))));
    else if (tagOf(n) === "w:tbl") parts.push(tableRows(n).map((r) => r.join(" | ")).join("\n"));
  }
  return parts.filter(Boolean).join("\n");
}

function tableRows(tbl: XNode): string[][] {
  return kids(tbl)
    .filter((n) => tagOf(n) === "w:tr")
    .map((tr) => kids(tr).filter((n) => tagOf(n) === "w:tc").map(cellText));
}

export function parseDocx(buf: Uint8Array): DocBlock[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf, { filter: (f) => f.name === "word/document.xml" });
  } catch {
    throw new DocParseError("DOCX 압축을 풀지 못했어요 (암호가 걸렸을 수 있어요)", "corrupt");
  }
  const xml = files["word/document.xml"];
  if (!xml) throw new DocParseError("DOCX 본문을 찾지 못했어요", "corrupt");
  const doc = parseXml(strFromU8(xml)).find((n) => tagOf(n) === "w:document");
  const body = doc ? kids(doc).find((n) => tagOf(n) === "w:body") : undefined;
  const blocks: DocBlock[] = [];
  const walk = (nodes: XNode[]) => {
    for (const n of nodes) {
      const t = tagOf(n);
      if (t === "w:p") {
        const text = clean(runText(kids(n)));
        if (text) blocks.push({ type: "p", text });
      } else if (t === "w:tbl") blocks.push({ type: "table", rows: tableRows(n) });
      else if (t === "w:sdt" || t === "w:sdtContent") walk(kids(n));
    }
  };
  walk(body ? kids(body) : []);
  return blocks;
}
