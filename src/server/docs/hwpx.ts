// HWPX (한/글 2014+ 개방형, zip + XML)
import { strFromU8, unzipSync } from "fflate";
import { clean, DocParseError, type DocBlock } from "./types";
import { kids, parseXml, tagOf, type XNode } from "./xml";

/** 문단 안 글자 (표·그림 등 컨트롤 안의 글자는 빼고) */
function paraText(p: XNode): string {
  let s = "";
  const walk = (nodes: XNode[]) => {
    for (const n of nodes) {
      const t = tagOf(n);
      if (t === "#text") s += String(n["#text"]);
      else if (t === "hp:t") walk(kids(n));
      else if (t === "hp:tab") s += "\t";
      else if (t === "hp:lineBreak") s += "\n";
      else if (t === "hp:run") walk(kids(n));
      // hp:tbl, hp:pic, hp:ctrl 등은 따로 처리하거나 무시
    }
  };
  walk(kids(p));
  return s;
}

function cellText(tc: XNode): string {
  const parts: string[] = [];
  const walk = (nodes: XNode[]) => {
    for (const n of nodes) {
      const t = tagOf(n);
      if (t === "hp:p") {
        parts.push(clean(paraText(n)));
        for (const r of kids(n)) if (tagOf(r) === "hp:run") for (const c of kids(r)) if (tagOf(c) === "hp:tbl") parts.push(tableRows(c).map((row) => row.join(" | ")).join("\n"));
      } else walk(kids(n));
    }
  };
  walk(kids(tc));
  return parts.filter(Boolean).join("\n");
}

function tableRows(tbl: XNode): string[][] {
  return kids(tbl)
    .filter((n) => tagOf(n) === "hp:tr")
    .map((tr) => kids(tr).filter((n) => tagOf(n) === "hp:tc").map(cellText));
}

function sectionBlocks(xml: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const root = parseXml(xml).find((n) => tagOf(n) === "hs:sec");
  if (!root) return blocks;
  for (const p of kids(root)) {
    if (tagOf(p) !== "hp:p") continue;
    const text = clean(paraText(p));
    if (text) blocks.push({ type: "p", text });
    for (const r of kids(p)) {
      if (tagOf(r) !== "hp:run") continue;
      for (const c of kids(r)) if (tagOf(c) === "hp:tbl") blocks.push({ type: "table", rows: tableRows(c) });
    }
  }
  return blocks;
}

export function parseHwpx(buf: Uint8Array): DocBlock[] {
  let files: Record<string, Uint8Array>;
  try {
    // 그림(BinData)은 풀지 않는다
    files = unzipSync(buf, { filter: (f) => f.name.startsWith("Contents/section") || f.name === "META-INF/manifest.xml" });
  } catch {
    throw new DocParseError("HWPX 압축을 풀지 못했어요", "corrupt");
  }
  const manifest = files["META-INF/manifest.xml"] ? strFromU8(files["META-INF/manifest.xml"]) : "";
  if (/encryption/i.test(manifest)) throw new DocParseError("암호가 걸린 HWPX예요", "encrypted");
  const sections = Object.keys(files)
    .filter((n) => /^Contents\/section\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!sections.length) throw new DocParseError("HWPX 본문을 찾지 못했어요", "corrupt");
  return sections.flatMap((n) => sectionBlocks(strFromU8(files[n])));
}
