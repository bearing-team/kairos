// 게시판 글 본문에 접수 기간이 없을 때(본문 없이 공고문만 첨부한 게시판) 공고문 첨부를 받아 읽는다
// server-only를 붙이지 않는다: manual.ts(게시판 확인, 워커·tsx)에서 쓴다
import { classifyAttachment, fileExt, linksFor, type FoundLink } from "@/server/drafting/links";
import { downloadFile } from "@/server/drafting/download";
import { parseDocument, PARSEABLE_EXT } from "@/server/docs";
import type { UrlExtractAttachment } from "@/server/prompts/url-extract.v2";

const DATE = /20\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/;
const PERIOD = /(접수|신청|모집|공고)\s*(기간|일정|마감|기한)|마감\s*일|까지/;

/** 본문에 접수 기간으로 볼 만한 줄(기간 낱말 + 날짜)이 있는지. 등록일만 있는 글은 없다고 본다 */
export function hasApplyPeriod(text: string): boolean {
  return text.split("\n").some((line, i, lines) => {
    if (!PERIOD.test(line)) return false;
    const near = [line, lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
    return DATE.test(near);
  });
}

/** 첨부 중 공고문 하나 (이름에 "공고"가 있고 양식이 아닌 hwp·hwpx·docx·pdf) */
export function pickNotice(links: FoundLink[]): FoundLink | null {
  return links.find((l) => PARSEABLE_EXT.includes(fileExt(l.fileName)) && classifyAttachment(l.fileName) === "notice") ?? null;
}

/** 본문에 기간이 없으면 공고문 첨부를 읽어 돌려준다. 못 읽으면 빈 배열 + 안내 (추출은 본문만으로 계속) */
export async function noticeAttachments(page: { url: string; html: string; text: string }): Promise<{ attachments: UrlExtractAttachment[]; note: string | null }> {
  if (hasApplyPeriod(page.text)) return { attachments: [], note: null };
  const notice = pickNotice(linksFor("board", page.html, page.url));
  if (!notice) return { attachments: [], note: null };
  try {
    const { buf } = await downloadFile(notice.url, page.url);
    const doc = await parseDocument(buf, notice.fileName);
    return { attachments: [{ fileName: notice.fileName, text: doc.text }], note: null };
  } catch (e) {
    return { attachments: [], note: `공고문 첨부를 읽지 못했어요 (${e instanceof Error ? e.message : "알 수 없는 오류"})` };
  }
}
