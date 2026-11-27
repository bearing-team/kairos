// HWP 5.x 양식 채우기: 표에서 "제목 칸 → 값 칸"을 찾아 필드로 만들고(readHwpForm), 값을 넣은 새 HWP를 만든다(fillHwp)
// 원본 레코드는 그대로 두고 값 칸의 문단만 고친다. 한/글은 열 때 줄 나눔을 다시 계산하지 않고 LINE_SEG를 그대로 쓰므로 줄 배치도 여기서 만든다
// 명세: 한글과컴퓨터 "한글 문서 파일 형식 5.0". server-only 없음 (tsx 스크립트에서도 씀)
import CFB from "cfb";
import { deflateSync, inflateSync } from "fflate";
import { DocParseError } from "./types";

const TAG = { PARA_HEADER: 66, PARA_TEXT: 67, CHAR_SHAPE: 68, LINE_SEG: 69, CTRL_HEADER: 71, LIST_HEADER: 72 } as const;
type Rec = { tag: number; level: number; data: Uint8Array };

export const CHECKED = "■";
const BOX = "□";

export type FormFieldKind = "text" | "choice";
export type FormField = {
  /** s{구역}t{표}r{행}c{열} — 같은 파일이면 늘 같다 */
  id: string;
  label: string;
  kind: FormFieldKind;
  /** text: replace = 칸을 값으로 바꿈, append = 칸의 머리말("(휴대전화)") 뒤에 붙임 */
  mode: "replace" | "append";
  /** append일 때 칸에 이미 있는 머리말 */
  prefix: string | null;
  /** 칸 안의 예시·안내 ("(예시) …", "※ 간략하게 작성") */
  hint: string | null;
  options: string[];
  multi: boolean;
};
export type FormTable = { id: string; rows: { label: string; fieldIds: string[] }[] };
export type HwpForm = { title: string | null; fields: FormField[] };
/** text: 값 문자열, choice: 고른 보기 */
export type FieldValues = Record<string, string | string[]>;

// ── 레코드 읽기·쓰기 ─────────────────────────────────────────────

function readRecords(buf: Uint8Array): Rec[] {
  const out: Rec[] = [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 0;
  while (o + 4 <= buf.length) {
    const h = dv.getUint32(o, true);
    o += 4;
    let size = h >>> 20;
    if (size === 0xfff) {
      size = dv.getUint32(o, true);
      o += 4;
    }
    if (o + size > buf.length) throw new DocParseError("HWP 본문 레코드가 깨져 있어요", "corrupt");
    out.push({ tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, data: buf.slice(o, o + size) });
    o += size;
  }
  return out;
}

function writeRecords(recs: Rec[]): Uint8Array {
  const size = recs.reduce((n, r) => n + 4 + (r.data.length >= 0xfff ? 4 : 0) + r.data.length, 0);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let o = 0;
  for (const r of recs) {
    const big = r.data.length >= 0xfff;
    dv.setUint32(o, ((big ? 0xfff : r.data.length) << 20) | ((r.level & 0x3ff) << 10) | (r.tag & 0x3ff), true);
    o += 4;
    if (big) {
      dv.setUint32(o, r.data.length, true);
      o += 4;
    }
    out.set(r.data, o);
    o += r.data.length;
  }
  return out;
}

const u16 = (d: Uint8Array, o: number) => d[o] | (d[o + 1] << 8);
const u32 = (d: Uint8Array, o: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(o, true);
const setU16 = (d: Uint8Array, o: number, v: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).setUint16(o, v, true);
const setU32 = (d: Uint8Array, o: number, v: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).setUint32(o, v >>> 0, true);
const ctrlId = (d: Uint8Array) => (d.length >= 4 ? String.fromCharCode(d[3], d[2], d[1], d[0]) : "");

/** 1칸짜리 제어 문자 (나머지 0~31은 8칸짜리 인라인·확장 컨트롤) */
const SHORT_CTRL = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);

function decodeText(d: Uint8Array): { text: string; plain: boolean } {
  let text = "";
  let plain = true;
  for (let i = 0; i + 1 < d.length; ) {
    const c = u16(d, i);
    if (c >= 32) {
      text += String.fromCharCode(c);
      i += 2;
    } else if (SHORT_CTRL.has(c)) {
      if (c === 10) text += "\n";
      else if (c === 30 || c === 31) text += " ";
      i += 2;
    } else {
      plain = false;
      if (c === 9) text += "\t";
      i += 16;
    }
  }
  return { text, plain };
}

function encodeText(s: string): Uint8Array {
  const units = [...s.replace(/\r\n?/g, "\n")].flatMap((ch) => {
    const c = ch.codePointAt(0)!;
    if (ch === "\n") return [10];
    if (c < 32) return [32];
    if (c > 0xffff) return [0xfffd]; // 이모지 등은 한/글 2바이트 범위 밖
    return [c];
  });
  const out = new Uint8Array((units.length + 1) * 2);
  units.forEach((u, i) => setU16(out, i * 2, u));
  setU16(out, units.length * 2, 13);
  return out;
}

// ── 구역 열기 ────────────────────────────────────────────────────

type Section = { entry: CFB.CFB$Entry; recs: Rec[] };
type Opened = { cfb: CFB.CFB$Container; compressed: boolean; sections: Section[] };

function open(buf: Uint8Array): Opened {
  let cfb: CFB.CFB$Container;
  try {
    cfb = CFB.read(Buffer.from(buf), { type: "buffer" });
  } catch {
    throw new DocParseError("HWP 파일을 열지 못했어요", "corrupt");
  }
  const raw = CFB.find(cfb, "/FileHeader")?.content;
  const header = raw ? Uint8Array.from(raw as ArrayLike<number>) : undefined;
  if (!header || header.length < 40 || !String.fromCharCode(...header.subarray(0, 17)).startsWith("HWP Document File")) {
    throw new DocParseError("한/글 문서가 아니에요", "unsupported");
  }
  const props = u32(header, 36);
  if (props & 0b10) throw new DocParseError("암호가 걸린 HWP예요", "encrypted");
  if (props & 0b100) throw new DocParseError("배포용 HWP라 고칠 수 없어요", "distribution");
  const compressed = (props & 1) === 1;
  const sections = cfb.FullPaths.map((p, i) => ({ p, entry: cfb.FileIndex[i] }))
    .filter(({ p }) => /\/BodyText\/Section\d+$/.test(p))
    .sort((a, b) => Number(a.p.match(/\d+$/)![0]) - Number(b.p.match(/\d+$/)![0]))
    .map(({ entry }) => {
      let data = Uint8Array.from(entry.content as ArrayLike<number>);
      if (compressed) {
        try {
          data = inflateSync(data);
        } catch {
          throw new DocParseError("HWP 본문 압축을 풀지 못했어요", "corrupt");
        }
      }
      return { entry, recs: readRecords(data) };
    });
  if (!sections.length) throw new DocParseError("HWP 본문을 찾지 못했어요", "corrupt");
  return { cfb, compressed, sections };
}

// ── 표·칸 찾기 ───────────────────────────────────────────────────

type Para = { header: number; end: number; text: string; plain: boolean; textRec: number | null; shape: number | null };
type Cell = { sec: number; tbl: number; row: number; col: number; width: number; list: number; level: number; paras: Para[] };

function parasIn(recs: Rec[], start: number, end: number, level: number): Para[] {
  const out: Para[] = [];
  for (let i = start; i < end; i++) {
    if (recs[i].tag !== TAG.PARA_HEADER || recs[i].level !== level) continue;
    let j = i + 1;
    while (j < end && recs[j].level > level) j++;
    let textRec: number | null = null;
    let shape: number | null = null;
    for (let k = i + 1; k < j; k++) {
      if (recs[k].level !== level + 1) continue;
      if (recs[k].tag === TAG.PARA_TEXT) textRec = k;
      if (recs[k].tag === TAG.CHAR_SHAPE && recs[k].data.length >= 8 && shape === null) shape = u32(recs[k].data, 4);
    }
    const dec = textRec !== null ? decodeText(recs[textRec].data) : { text: "", plain: true };
    out.push({ header: i, end: j, text: dec.text.trim(), plain: dec.plain, textRec, shape });
    i = j - 1;
  }
  return out;
}

/** 모든 표의 칸 (표 안의 표는 그 표의 칸으로 따로 센다) */
function findCells(o: Opened): Cell[] {
  const cells: Cell[] = [];
  o.sections.forEach(({ recs }, sec) => {
    let tbl = 0;
    for (let i = 0; i < recs.length; i++) {
      if (recs[i].tag !== TAG.CTRL_HEADER || ctrlId(recs[i].data) !== "tbl ") continue;
      const lvl = recs[i].level;
      let end = i + 1;
      while (end < recs.length && recs[end].level > lvl) end++;
      const t = tbl++;
      const heads: number[] = [];
      for (let k = i + 1; k < end; k++) if (recs[k].tag === TAG.LIST_HEADER && recs[k].level === lvl + 1) heads.push(k);
      heads.forEach((h, idx) => {
        const e = idx + 1 < heads.length ? heads[idx + 1] : end;
        const d = recs[h].data;
        if (d.length < 12) return;
        cells.push({ sec, tbl: t, col: u16(d, 8), row: u16(d, 10), width: d.length >= 20 ? u32(d, 16) : 0, list: h, level: lvl + 1, paras: parasIn(recs, h + 1, e, lvl + 1) });
      });
    }
  });
  return cells;
}

// ── 필드 고르기 ──────────────────────────────────────────────────

const cellText = (c: Cell) => c.paras.map((p) => p.text).filter(Boolean).join(" ");
const isHint = (t: string) => /^※/.test(t);
const isExample = (t: string) => /^\(?\s*(예시|예)\s*[)\]:]/.test(t);
const PREFIX = /^\(([^()]{1,12})\)$/;
/** 1cm (HWPUNIT 7200 = 1인치). 이보다 좁은 빈 칸은 글자를 넣을 칸이 아니라 간격용 */
const MIN_VALUE_WIDTH = 2835;
const boxCount = (t: string) => t.split(BOX).length - 1;

/** "□ 기업   □ 대학 … □ 기타(        )" → ["기업", "대학", …, "기타"] */
export function choiceOptions(t: string): string[] {
  return t
    .split(BOX)
    .slice(1)
    .map((s) => s.replace(/\(\s*\)/g, "").replace(/[(:].*$/, "").trim())
    .filter(Boolean);
}

function fieldFor(label: Cell, value: Cell): FormField | null {
  const labelParas = label.paras.map((p) => p.text).filter(Boolean);
  const multi = labelParas.some((t) => /복수/.test(t));
  const labelText = labelParas
    .filter((t) => !isHint(t))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!labelText || labelText.length > 40) return null;
  if (!value.paras.every((p) => p.plain)) return null; // 그림·필드 같은 컨트롤이 든 칸은 건드리지 않는다
  if (value.width && value.width < MIN_VALUE_WIDTH) return null; // 장식용 좁은 칸
  const id = `s${value.sec}t${value.tbl}r${value.row}c${value.col}`;
  const texts = value.paras.map((p) => p.text).filter(Boolean);
  const base = { id, label: labelText, multi: false, options: [] as string[], prefix: null as string | null, hint: null as string | null };

  if (!texts.length) return { ...base, kind: "text", mode: "replace" };
  const joined = texts.join(" ");
  if (boxCount(joined) >= 2 && value.paras.filter((p) => p.text).length === 1) {
    return { ...base, kind: "choice", mode: "replace", options: choiceOptions(joined), multi };
  }
  if (texts.length === 1 && PREFIX.test(texts[0])) {
    const inner = texts[0].match(PREFIX)![1].trim();
    return { ...base, kind: "text", mode: "append", prefix: texts[0], label: `${labelText} (${inner})` };
  }
  if (texts.every((t) => isExample(t) || isHint(t))) return { ...base, kind: "text", mode: "replace", hint: texts.join("\n") };
  return null; // 이미 내용이 있는 칸 (제목·설명)
}

function fieldsOf(cells: Cell[]): FormField[] {
  const out: FormField[] = [];
  const byTable = new Map<string, Cell[]>();
  for (const c of cells) {
    const k = `${c.sec}:${c.tbl}`;
    byTable.set(k, [...(byTable.get(k) ?? []), c]);
  }
  for (const list of byTable.values()) {
    const rows = new Map<number, Cell[]>();
    for (const c of list) rows.set(c.row, [...(rows.get(c.row) ?? []), c]);
    for (const row of [...rows.keys()].sort((a, b) => a - b)) {
      const rc = rows.get(row)!.sort((a, b) => a.col - b.col);
      // "제목 | 값 | 제목 | 값" 또는 "제목 | 값(휴대전화) | 값(사무실) | 값(E-mail)"
      let label: Cell | null = null;
      for (const c of rc) {
        const t = cellText(c);
        const f = label ? fieldFor(label, c) : null;
        if (f) {
          out.push(f);
          continue;
        }
        label = t && !boxCount(t) && !PREFIX.test(t) && !isExample(t) ? c : null;
      }
    }
  }
  return out;
}

export function readHwpForm(buf: Uint8Array): HwpForm {
  const o = open(buf);
  const cells = findCells(o);
  // 제목: 첫 표의 칸 하나짜리 큰 글자 (없으면 본문 첫 문단)
  const first = cells.find((c) => c.sec === 0 && c.tbl === 0);
  const firstTable = cells.filter((c) => c.sec === 0 && c.tbl === 0);
  const title = firstTable.length === 1 && first ? cellText(first) || null : (parasIn(o.sections[0].recs, 0, o.sections[0].recs.length, 0).find((p) => p.text)?.text ?? null);
  return { title, fields: fieldsOf(cells) };
}

// ── 채우기 ───────────────────────────────────────────────────────

/** 글자 폭 어림 (글자 크기 대비). 실제보다 넓게 잡아 줄이 넘치지 않게 한다 — 덜 차면 줄 끝이 조금 비는 정도 */
function charWidth(ch: string): number {
  if (ch === " ") return 0.5;
  const c = ch.charCodeAt(0);
  if (c >= 0x1100 && c <= 0x11ff) return 1;
  if (c >= 0x2e80) return 1; // 한글·한자·전각 기호
  if (c >= 0x2000 && c <= 0x2bff) return 1; // 「」·※ 같은 기호
  return 0.6; // 영문·숫자·문장 부호
}

/** 줄 시작 위치들 (글자 단위). 줄바꿈(\n)에서 끊고, 넘치면 마지막 띄어쓰기에서 (없으면 그 글자에서) 끊는다 */
export function breakLines(text: string, widthEm: number): number[] {
  const chars = [...text.replace(/\r\n?/g, "\n")];
  const starts = [0];
  let used = 0;
  let lastSpace = -1;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") {
      starts.push(i + 1);
      used = 0;
      lastSpace = -1;
      continue;
    }
    const w = charWidth(ch);
    if (used + w > widthEm && i > starts[starts.length - 1]) {
      const cut = lastSpace > starts[starts.length - 1] ? lastSpace + 1 : i;
      starts.push(cut);
      used = chars.slice(cut, i).reduce((n, c) => n + charWidth(c), 0);
      lastSpace = -1;
    }
    used += w;
    if (ch === " ") lastSpace = i;
  }
  return starts.filter((v, i, a) => v < chars.length && a.indexOf(v) === i);
}

/** LINE_SEG 한 줄(36바이트)을 본으로 줄마다 하나씩: 시작 위치(0), 세로 위치(4), 줄 높이(8), 글자 높이(12), 기준선(16), 줄 간격(20), 단 시작(24), 폭(28), 속성(32) */
function lineSegs(template: Uint8Array, text: string): Uint8Array {
  const dv = new DataView(template.buffer, template.byteOffset, 36);
  const vpos = dv.getInt32(4, true);
  const height = dv.getInt32(8, true);
  const textHeight = dv.getInt32(12, true) || height || 1000;
  const spacing = dv.getInt32(20, true);
  const width = dv.getInt32(28, true);
  const starts = width > 0 ? breakLines(text, (width / textHeight) * 0.97) : [0];
  const out = new Uint8Array(36 * Math.max(1, starts.length));
  (starts.length ? starts : [0]).forEach((start, i) => {
    out.set(template, i * 36);
    setU32(out, i * 36, start);
    new DataView(out.buffer).setInt32(i * 36 + 4, vpos + i * (height + spacing), true);
  });
  return out;
}

/** 문단 하나의 글자를 바꾼다: PARA_TEXT 새로, 글자 모양은 첫 것만(또는 shape), 줄 배치는 첫 줄만 */
function setParaText(recs: Rec[], p: Para, text: string, shape: number | null, insertAt: Map<number, Rec[]>, drop: Set<number>) {
  const header = recs[p.header];
  const enc = encodeText(text);
  const nChars = enc.length / 2;
  setU32(header.data, 0, (u32(header.data, 0) & 0x80000000) | nChars);
  if (p.textRec !== null) recs[p.textRec].data = enc;
  else insertAt.set(p.header, [{ tag: TAG.PARA_TEXT, level: header.level + 1, data: enc }]);
  for (let k = p.header + 1; k < p.end; k++) {
    const r = recs[k];
    if (r.level !== header.level + 1) continue;
    if (r.tag === TAG.CHAR_SHAPE && r.data.length >= 8) {
      const d = r.data.slice(0, 8);
      setU32(d, 0, 0);
      if (shape !== null) setU32(d, 4, shape);
      r.data = d;
      setU16(header.data, 12, 1);
    }
    if (r.tag === TAG.LINE_SEG && r.data.length >= 36) {
      r.data = lineSegs(r.data.slice(0, 36), text);
      setU16(header.data, 16, r.data.length / 36);
    }
    if (r.tag === 70) drop.add(k); // RANGE_TAG: 글자 위치가 바뀌니 뺀다
  }
  if (header.data.length >= 16) setU16(header.data, 14, 0);
}

/** 값 칸의 문단을 하나로 줄인다 (나머지 문단 레코드 삭제 + 마지막 문단 표시 옮기기) */
function keepFirstPara(recs: Rec[], cell: Cell, drop: Set<number>) {
  if (cell.paras.length < 2) return;
  for (const p of cell.paras.slice(1)) for (let k = p.header; k < p.end; k++) drop.add(k);
  const first = recs[cell.paras[0].header].data;
  setU32(first, 0, u32(first, 0) | 0x80000000);
  setU16(recs[cell.list].data, 0, 1);
}

/** 표에서 빈 값 칸이 쓰는 글자 모양 (예시 글자의 파란 기울임 대신 쓸 것) */
function plainShape(cells: Cell[], cell: Cell): number | null {
  const count = new Map<number, number>();
  for (const c of cells) {
    if (c.sec !== cell.sec || c.tbl !== cell.tbl) continue;
    for (const p of c.paras) if (!p.text && p.shape !== null) count.set(p.shape, (count.get(p.shape) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export type FillResult = { buf: Uint8Array; filled: string[]; skipped: string[] };

export function fillHwp(buf: Uint8Array, values: FieldValues): FillResult {
  const o = open(buf);
  const cells = findCells(o);
  const fields = new Map(fieldsOf(cells).map((f) => [f.id, f]));
  const filled: string[] = [];
  const skipped: string[] = [];
  const edits = o.sections.map(() => ({ insertAt: new Map<number, Rec[]>(), drop: new Set<number>() }));

  for (const [id, raw] of Object.entries(values)) {
    const f = fields.get(id);
    const cell = cells.find((c) => `s${c.sec}t${c.tbl}r${c.row}c${c.col}` === id);
    if (!f || !cell || !cell.paras.length) {
      skipped.push(id);
      continue;
    }
    const { recs } = o.sections[cell.sec];
    const ed = edits[cell.sec];
    if (f.kind === "choice") {
      const picked = new Set((Array.isArray(raw) ? raw : String(raw).split(/[,·]/)).map((s) => s.trim()).filter(Boolean));
      const p = cell.paras.find((x) => boxCount(x.text) >= 2);
      if (!p || p.textRec === null || !picked.size) {
        skipped.push(id);
        continue;
      }
      // 같은 길이 바꾸기라 구조는 그대로: 고른 보기 앞의 □만 ■로
      const d = recs[p.textRec].data;
      const { text } = decodeText(d);
      const opts = choiceOptions(text);
      let boxIdx = -1;
      for (let i = 0; i + 1 < d.length; i += 2) {
        if (u16(d, i) !== BOX.charCodeAt(0)) continue;
        boxIdx++;
        if (picked.has(opts[boxIdx])) setU16(d, i, CHECKED.charCodeAt(0));
      }
      filled.push(id);
      continue;
    }
    const value = (Array.isArray(raw) ? raw.join(", ") : raw).trim();
    if (!value) {
      skipped.push(id);
      continue;
    }
    const p = cell.paras[0];
    if (f.mode === "append") {
      setParaText(recs, p, `${f.prefix ?? ""} ${value}`.trim(), null, ed.insertAt, ed.drop);
    } else {
      keepFirstPara(recs, cell, ed.drop);
      setParaText(recs, p, value, f.hint ? plainShape(cells, cell) : null, ed.insertAt, ed.drop);
    }
    filled.push(id);
  }

  o.sections.forEach((s, i) => {
    const { insertAt, drop } = edits[i];
    if (!filled.length) return;
    const next: Rec[] = [];
    s.recs.forEach((r, k) => {
      if (!drop.has(k)) next.push(r);
      for (const extra of insertAt.get(k) ?? []) next.push(extra);
    });
    let data = writeRecords(next);
    if (o.compressed) data = deflateSync(data, { level: 6 });
    s.entry.content = Buffer.from(data) as unknown as CFB.CFB$Blob;
    s.entry.size = data.length;
  });
  // 미리보기 글자(PrvText)는 옛 내용이라 비워 둔다 (탐색기 미리보기용, 열 때는 안 씀)
  const prv = CFB.find(o.cfb, "/PrvText");
  if (prv && filled.length) {
    prv.content = Buffer.alloc(0) as unknown as CFB.CFB$Blob;
    prv.size = 0;
  }
  const out = CFB.write(o.cfb, { type: "buffer", fileType: "cfb" }) as Buffer;
  return { buf: new Uint8Array(out), filled, skipped };
}
