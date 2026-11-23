// PDF (글자 레이어만. 스캔본은 글자가 없어 실패로 본다)
import { extractText, getDocumentProxy } from "unpdf";
import { clean, DocParseError, type DocBlock } from "./types";

export async function parsePdf(buf: Uint8Array): Promise<DocBlock[]> {
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    pages = (await extractText(pdf, { mergePages: false })).text as string[];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/password/i.test(msg)) throw new DocParseError("암호가 걸린 PDF예요", "encrypted");
    throw new DocParseError("PDF를 읽지 못했어요", "corrupt");
  }
  return pages.flatMap((t) => clean(t).split("\n")).filter(Boolean).map((text) => ({ type: "p" as const, text }));
}
