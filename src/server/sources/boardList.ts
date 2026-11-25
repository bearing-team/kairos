import { parseHTML } from "linkedom";
import { cleanText } from "./text";

export type ListLink = { href: string; text: string; context: string };
export type ListPage = { url: string; title: string | null; links: ListLink[]; scriptRows: number; linkRows: number };

const FILE = /\.(hwp|hwpx|docx?|pdf|zip|xlsx?|jpe?g|png)(\?|$)|download|fileDown|atchFile/i;
const SESSION = /;jsessionid=[^?#]*/i;

/** 게시판 글 주소 비교용: 해시·세션 ID 제거 */
export function canonicalLink(href: string): string {
  const u = new URL(href);
  u.hash = "";
  u.pathname = u.pathname.replace(SESSION, "");
  return u.toString();
}

/**
 * 게시판 목록 HTML → 글 후보 링크 (주소·글자·그 줄의 글자).
 * 그 줄(tr/li)의 글자에는 접수 기간·마감 표시가 같이 있어 LLM이 고를 때 쓴다.
 * scriptRows: 링크 없이 onclick·"#"으로만 여는 줄 수, linkRows: 글 주소 링크가 있는 표 줄 수 (스크립트 게시판 판별용.
 * 메뉴 li는 링크가 많아 섞이므로 linkRows는 표(tbody tr)만 센다)
 */
export function readListPage(html: string, pageUrl: string): ListPage {
  const { document } = parseHTML(html);
  const title = cleanText(document.querySelector("title")?.textContent ?? "");
  const self = canonicalLink(pageUrl);
  const seen = new Map<string, ListLink>();

  for (const a of document.querySelectorAll("a[href]")) {
    const raw = a.getAttribute("href") ?? "";
    if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) continue;
    let href: string;
    try {
      href = canonicalLink(new URL(raw, pageUrl).toString());
    } catch {
      continue;
    }
    if (!/^https?:/.test(href) || href === self || FILE.test(href)) continue;
    const text = (cleanText(a.textContent ?? "") ?? cleanText(a.getAttribute("title") ?? "") ?? "").replace(/\s+/g, " ");
    if (text.length < 4) continue;
    const row = a.closest("tr") ?? a.closest("li");
    const context = row ? (cleanText(row.textContent ?? "") ?? "").replace(/\s+/g, " ").slice(0, 240) : "";
    const prev = seen.get(href);
    // 같은 글에 링크가 여럿이면 글자가 긴 쪽 (아이콘 링크보다 제목 링크)
    if (!prev || text.length > prev.text.length) seen.set(href, { href, text: text.slice(0, 200), context });
  }

  let scriptRows = 0;
  let linkRows = 0;
  for (const row of document.querySelectorAll("tbody tr, li")) {
    if (row.tagName === "LI" && row.querySelector("ul, ol")) continue; // 하위 메뉴를 품은 메뉴 항목
    const text = (cleanText(row.textContent ?? "") ?? "").replace(/\s+/g, " ");
    if (text.length < 10) continue;
    const anchors = [...row.querySelectorAll("a")];
    const hasRealLink = anchors.some((a) => {
      const h = a.getAttribute("href") ?? "";
      return h && !h.startsWith("#") && !/^javascript:/i.test(h);
    });
    const opensByScript = row.hasAttribute("onclick") || anchors.some((a) => a.hasAttribute("onclick") || /^(#|javascript:)/i.test(a.getAttribute("href") ?? ""));
    if (!hasRealLink && opensByScript) scriptRows++;
    if (hasRealLink && row.tagName === "TR") linkRows++;
  }

  return { url: pageUrl, title, links: [...seen.values()].slice(0, 400), scriptRows, linkRows };
}
