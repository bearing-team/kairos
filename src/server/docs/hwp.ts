// HWP 5.x (한/글 97 이후 바이너리, OLE 복합 문서 + 레코드 스트림)
// 명세: 한글과컴퓨터 "한글 문서 파일 형식 5.0" (공개 문서)
import CFB from "cfb";
import { inflateSync } from "fflate";
import { clean, DocParseError, type DocBlock } from "./types";

const TAG = { PARA_HEADER: 66, PARA_TEXT: 67, CTRL_HEADER: 71, LIST_HEADER: 72, TABLE: 77 } as const;
type Rec = { tag: number; level: number; data: Uint8Array };

function readRecords(buf: Uint8Array): Rec[] {
  const out: Rec[] = [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 0;
  while (o + 4 <= buf.length) {
    const h = dv.getUint32(o, true);
    o += 4;
    let size = h >>> 20;
    if (size === 0xfff) {
      if (o + 4 > buf.length) break;
      size = dv.getUint32(o, true);
      o += 4;
    }
    if (o + size > buf.length) break;
    out.push({ tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, data: buf.subarray(o, o + size) });
    o += size;
  }
  return out;
}

/** PARA_TEXT: UTF-16LE. 0~31은 제어 문자 — 1칸짜리(문자형)와 8칸짜리(인라인·확장형)가 있다 */
function paraText(d: Uint8Array): string {
  const n = d.length >> 1;
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let s = "";
  for (let i = 0; i < n; ) {
    const c = dv.getUint16(i * 2, true);
    if (c >= 32) {
      s += String.fromCharCode(c);
      i++;
    } else if (c === 0 || c === 10 || c === 13 || (c >= 24 && c <= 31)) {
      if (c === 10) s += "\n";
      else if (c === 30 || c === 31) s += " ";
      i++;
    } else {
      if (c === 9) s += "\t";
      i += 8;
    }
  }
  return s;
}

const ctrlId = (d: Uint8Array) => (d.length >= 4 ? String.fromCharCode(d[3], d[2], d[1], d[0]) : "");

/** recs[start..end) 안에서 level인 문단들을 블록으로 */
function walk(recs: Rec[], start: number, end: number, level: number, out: DocBlock[]) {
  for (let i = start; i < end; i++) {
    const r = recs[i];
    if (r.tag !== TAG.PARA_HEADER || r.level !== level) continue;
    let j = i + 1;
    while (j < end && recs[j].level > level) j++;
    // 문단 글자
    let text = "";
    for (let k = i + 1; k < j; k++) if (recs[k].tag === TAG.PARA_TEXT && recs[k].level === level + 1) text += paraText(recs[k].data);
    const t = clean(text);
    if (t) out.push({ type: "p", text: t });
    // 문단 안 컨트롤 (표, 글상자 등)
    for (let k = i + 1; k < j; k++) {
      const c = recs[k];
      if (c.tag !== TAG.CTRL_HEADER || c.level !== level + 1) continue;
      let ce = k + 1;
      while (ce < j && recs[ce].level > level + 1) ce++;
      const id = ctrlId(c.data);
      if (id === "tbl ") out.push({ type: "table", rows: table(recs, k + 1, ce, level + 2) });
      else if (id === "gso " || id === "tcps") {
        // 글상자 안 문단 — 문단 레벨이 일정하지 않아 가장 얕은 PARA_HEADER 레벨로
        let min = Infinity;
        for (let q = k + 1; q < ce; q++) if (recs[q].tag === TAG.PARA_HEADER) min = Math.min(min, recs[q].level);
        if (min !== Infinity) walk(recs, k + 1, ce, min, out);
      }
      // 머리말·꼬리말·각주(head, foot, fn  , en  ) 등은 양식 본문이 아니라 건너뜀
      k = ce - 1;
    }
    i = j - 1;
  }
}

function table(recs: Rec[], start: number, end: number, level: number): string[][] {
  const cells: { row: number; col: number; text: string }[] = [];
  const heads: number[] = [];
  for (let i = start; i < end; i++) if (recs[i].tag === TAG.LIST_HEADER && recs[i].level === level) heads.push(i);
  heads.forEach((h, idx) => {
    const e = idx + 1 < heads.length ? heads[idx + 1] : end;
    const d = recs[h].data;
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    // LIST_HEADER: 문단 수(2) + 예약(2) + 속성(4), 이어서 셀 속성: 열 주소(2) 행 주소(2) …
    const col = d.length >= 12 ? dv.getUint16(8, true) : cells.length;
    const row = d.length >= 12 ? dv.getUint16(10, true) : 0;
    const parts: DocBlock[] = [];
    walk(recs, h + 1, e, level, parts);
    const text = parts.map((b) => (b.type === "p" ? b.text : b.rows.map((r) => r.join(" | ")).join("\n"))).join("\n");
    cells.push({ row, col, text });
  });
  const rows: string[][] = [];
  for (const c of cells) (rows[c.row] ??= []).push(c.text);
  return rows.filter(Boolean);
}

export function parseHwp(buf: Uint8Array): DocBlock[] {
  let cfb: CFB.CFB$Container;
  try {
    cfb = CFB.read(Buffer.from(buf), { type: "buffer" });
  } catch {
    throw new DocParseError("HWP 파일을 열지 못했어요", "corrupt");
  }
  const raw = CFB.find(cfb, "/FileHeader")?.content;
  const header = raw ? Uint8Array.from(raw as ArrayLike<number>) : undefined;
  if (!header || header.length < 40 || !String.fromCharCode(...header.subarray(0, 17)).startsWith("HWP Document File")) {
    throw new DocParseError("한/글 문서가 아니에요 (Word .doc일 수 있어요)", "unsupported");
  }
  const props = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(36, true);
  if (props & 0b10) throw new DocParseError("암호가 걸린 HWP예요", "encrypted");
  if (props & 0b100) throw new DocParseError("배포용 HWP라 글자를 꺼낼 수 없어요", "distribution");
  const compressed = (props & 1) === 1;

  const sections = cfb.FullPaths.map((p, i) => ({ p, e: cfb.FileIndex[i] }))
    .filter(({ p }) => /\/BodyText\/Section\d+$/.test(p))
    .sort((a, b) => Number(a.p.match(/\d+$/)![0]) - Number(b.p.match(/\d+$/)![0]));
  if (!sections.length) throw new DocParseError("HWP 본문을 찾지 못했어요", "corrupt");

  const blocks: DocBlock[] = [];
  for (const { e } of sections) {
    let data = Uint8Array.from(e.content as ArrayLike<number>);
    if (compressed) {
      try {
        data = inflateSync(data);
      } catch {
        throw new DocParseError("HWP 본문 압축을 풀지 못했어요", "corrupt");
      }
    }
    const recs = readRecords(data);
    walk(recs, 0, recs.length, 0, blocks);
  }
  return blocks;
}
