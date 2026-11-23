import { describe, expect, it } from "vitest";
import CFB from "cfb";
import { deflateSync, strToU8, zipSync } from "fflate";
import { detectFormat, parseDocument } from "./index";
import { DocParseError } from "./types";

// 실제 양식 샘플은 fixtures/forms/ (커밋 안 함, pnpm forms:measure). 여기서는 같은 구조를 작게 만들어 검사한다

const HP = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"';
function hwpx(body: string) {
  return zipSync({
    mimetype: strToU8("application/hwp+zip"),
    "Contents/section0.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?><hs:sec ${HP}>${body}</hs:sec>`),
  });
}
const p = (t: string) => `<hp:p><hp:run><hp:t>${t}</hp:t></hp:run></hp:p>`;

describe("HWPX", () => {
  it("문단과 표를 순서대로 읽는다", async () => {
    const buf = hwpx(
      p("1. 문제 인식") +
        `<hp:p><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList>${p("기업명")}</hp:subList></hp:tc><hp:tc><hp:subList>${p("")}</hp:subList></hp:tc></hp:tr>` +
        `<hp:tr><hp:tc><hp:subList>${p("매출")}${p("(원)")}</hp:subList></hp:tc><hp:tc><hp:subList>${p("원")}</hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>` +
        `<hp:p><hp:run><hp:t>※ 작성 요령&amp;예시</hp:t><hp:lineBreak/><hp:t>둘째 줄</hp:t></hp:run></hp:p>`,
    );
    expect(detectFormat(buf, "a.hwpx")).toBe("hwpx");
    const doc = await parseDocument(buf, "a.hwpx");
    expect(doc.blocks[0]).toEqual({ type: "p", text: "1. 문제 인식" });
    expect(doc.blocks[1]).toEqual({ type: "table", rows: [["기업명", ""], ["매출\n(원)", "원"]] });
    expect(doc.text).toContain("[표]\n기업명 | \n매출 / (원) | 원\n[/표]");
    expect(doc.text).toContain("※ 작성 요령&예시\n둘째 줄");
  });

  it("글자가 거의 없으면 empty", async () => {
    await expect(parseDocument(hwpx(p("짧음")), "a.hwpx")).rejects.toMatchObject({ code: "empty" });
  });
});

describe("DOCX", () => {
  it("본문과 표", async () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const xml = `<w:document ${W}><w:body><w:p><w:r><w:t>사업계획서 작성 요령입니다</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>항목</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>내용</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
    const buf = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(xml) });
    const doc = await parseDocument(buf, "a.docx");
    expect(doc.format).toBe("docx");
    expect(doc.blocks).toEqual([
      { type: "p", text: "사업계획서 작성 요령입니다" },
      { type: "table", rows: [["항목", "내용"]] },
    ]);
  });
});

// ── HWP 5 바이너리: 레코드 스트림을 직접 만든다 ──
function rec(tag: number, level: number, data: Uint8Array) {
  const h = new Uint8Array(4);
  new DataView(h.buffer).setUint32(0, tag | (level << 10) | (data.length << 20), true);
  return [h, data];
}
const u16 = (...xs: number[]) => {
  const b = new Uint8Array(xs.length * 2);
  xs.forEach((x, i) => new DataView(b.buffer).setUint16(i * 2, x, true));
  return b;
};
const text = (s: string) => u16(...[...s].map((c) => c.charCodeAt(0)), 13);
function listHeader(col: number, row: number) {
  const b = new Uint8Array(34);
  const dv = new DataView(b.buffer);
  dv.setUint16(0, 1, true);
  dv.setUint16(8, col, true);
  dv.setUint16(10, row, true);
  return b;
}
function hwp5(opts: { compressed?: boolean; flags?: number } = {}) {
  const compressed = opts.compressed ?? true;
  const parts = [
    ...rec(66, 0, new Uint8Array(22)),
    ...rec(67, 1, text("1. 사업 개요와 목표를 쓰세요")),
    // 표가 든 문단: 확장 컨트롤 문자(11) 8칸 + 문단 끝
    ...rec(66, 0, new Uint8Array(22)),
    ...rec(67, 1, u16(11, 0x7462, 0x6c20, 0, 0, 0, 0, 11, 13)),
    ...rec(71, 1, new Uint8Array([0x20, 0x6c, 0x62, 0x74])), // 'tbl '
    ...rec(77, 2, new Uint8Array(20)),
    ...rec(72, 2, listHeader(0, 0)),
    ...rec(66, 2, new Uint8Array(22)),
    ...rec(67, 3, text("기업명")),
    ...rec(72, 2, listHeader(1, 0)),
    ...rec(66, 2, new Uint8Array(22)),
    ...rec(67, 3, text("베어링")),
    ...rec(72, 2, listHeader(0, 1)),
    ...rec(66, 2, new Uint8Array(22)),
    ...rec(67, 3, u16(0x9, 0, 0, 0, 0, 0, 0, 0x9, ...[..."탭 뒤"].map((c) => c.charCodeAt(0)), 13)),
  ];
  const raw = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) {
    raw.set(x, o);
    o += x.length;
  }
  const header = new Uint8Array(256);
  header.set(strToU8("HWP Document File"), 0);
  new DataView(header.buffer).setUint32(36, opts.flags ?? (compressed ? 1 : 0), true);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, "/FileHeader", Buffer.from(header));
  CFB.utils.cfb_add(cfb, "/BodyText/Section0", Buffer.from(compressed ? deflateSync(raw) : raw));
  return new Uint8Array(CFB.write(cfb, { type: "buffer" }) as Buffer);
}

describe("HWP 5", () => {
  it("압축된 본문에서 문단·표(행·열 주소)를 읽는다", async () => {
    const buf = hwp5();
    expect(detectFormat(buf, "a.hwp")).toBe("hwp");
    const doc = await parseDocument(buf, "a.hwp");
    expect(doc.blocks).toEqual([
      { type: "p", text: "1. 사업 개요와 목표를 쓰세요" },
      { type: "table", rows: [["기업명", "베어링"], ["탭 뒤"]] },
    ]);
  });

  it("압축 안 된 본문도", async () => {
    const doc = await parseDocument(hwp5({ compressed: false }), "a.hwp");
    expect(doc.blocks[0]).toEqual({ type: "p", text: "1. 사업 개요와 목표를 쓰세요" });
  });

  it("배포용·암호 문서는 이유를 알려 준다", async () => {
    await expect(parseDocument(hwp5({ flags: 0b101 }), "a.hwp")).rejects.toMatchObject({ code: "distribution" });
    await expect(parseDocument(hwp5({ flags: 0b11 }), "a.hwp")).rejects.toMatchObject({ code: "encrypted" });
  });
});

describe("형식 판별", () => {
  it("모르는 형식은 unsupported", async () => {
    await expect(parseDocument(strToU8("hello world, this is plain text"), "a.txt")).rejects.toBeInstanceOf(DocParseError);
  });
});
