// 첨부 문서 → 텍스트. Node 안에서만 (doc-worker 없음 — docs/forms-parsing.md 참고)
import { parseDocx } from "./docx";
import { parseHwp } from "./hwp";
import { parseHwpx } from "./hwpx";
import { parsePdf } from "./pdf";
import { blocksToText, DocParseError, type DocFormat, type ParsedDoc } from "./types";

export { blocksToText, DocParseError } from "./types";
export type { DocBlock, DocFormat, ParsedDoc } from "./types";

/** 확장자보다 파일 머리(매직 바이트)를 먼저 본다 */
export function detectFormat(buf: Uint8Array, fileName = ""): DocFormat | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const head = (n: number) => String.fromCharCode(...buf.subarray(0, n));
  if (head(4) === "%PDF") return "pdf";
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return "hwp";
  if (head(2) === "PK") {
    // zip 안 이름표: HWPX는 mimetype에 hwp+zip, DOCX는 [Content_Types].xml + word/
    const s = String.fromCharCode(...buf.subarray(0, Math.min(buf.length, 200)));
    if (s.includes("hwp+zip") || ext === "hwpx") return "hwpx";
    if (ext === "docx") return "docx";
    return ext === "hwpx" ? "hwpx" : "docx";
  }
  return null;
}

export const PARSEABLE_EXT = ["hwp", "hwpx", "docx", "pdf"];

export async function parseDocument(buf: Uint8Array, fileName = ""): Promise<ParsedDoc & { text: string }> {
  const format = detectFormat(buf, fileName);
  if (!format) throw new DocParseError("읽을 수 없는 형식이에요 (hwp, hwpx, docx, pdf만)", "unsupported");
  const blocks =
    format === "hwpx" ? parseHwpx(buf) : format === "docx" ? parseDocx(buf) : format === "hwp" ? parseHwp(buf) : await parsePdf(buf);
  const text = blocksToText(blocks);
  if (text.replace(/\s/g, "").length < 20) {
    throw new DocParseError(format === "pdf" ? "글자가 없는 PDF예요 (스캔본일 수 있어요)" : "문서에서 글자를 찾지 못했어요", "empty");
  }
  return { format, blocks, text };
}
