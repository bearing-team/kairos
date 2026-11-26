import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { cleanText } from "./text";

export type FetchedPage = { url: string; title: string | null; text: string; links: { text: string; href: string }[] };

function isPrivate(ip: string) {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** 붙여넣은 공고 URL을 정규화 (해시 제거). http(s)만 허용 */
export function normalizeUrl(input: string): string {
  const u = new URL(input.trim());
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("http 또는 https 주소만 넣을 수 있어요");
  u.hash = "";
  return u.toString();
}

/** 내부망 주소로 요청하지 않도록 막는다 (서버가 대신 fetch하므로) */
export async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (ips.some(isPrivate)) throw new Error("내부망 주소는 가져올 수 없어요");
}

const UA = "Mozilla/5.0 (compatible; kairos/0.1)";

/** 공개 주소만 받아 HTML 문자열로 (리다이렉트 뒤 주소도 내부망 검사) */
export async function fetchHtml(rawUrl: string): Promise<{ url: string; html: string }> {
  const url = new URL(normalizeUrl(rawUrl));
  await assertPublicHost(url);
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": UA, accept: "text/html,*/*" },
  });
  if (!res.ok) throw new Error(`페이지를 열지 못했어요 (HTTP ${res.status})`);
  const finalUrl = new URL(res.url || url.toString());
  await assertPublicHost(finalUrl);
  return { url: finalUrl.toString(), html: (await res.text()).slice(0, 2_000_000) };
}

/** 페이지를 받아 본문 텍스트와 첨부로 보이는 링크를 뽑는다 */
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const { url, html } = await fetchHtml(rawUrl);
  return readPage(html, url);
}

/** HTML → 제목·본문·첨부 링크 (fetch 없이, 테스트용으로 분리) */
export function readPage(html: string, url: string): FetchedPage {
  const { document } = parseHTML(html);
  const pageTitle = cleanText(document.querySelector("title")?.textContent ?? "");
  const links = [...document.querySelectorAll("a[href]")]
    .map((a) => ({ text: cleanText(a.textContent ?? "") ?? "", href: a.getAttribute("href") ?? "" }))
    .filter((l) => /\.(hwp|hwpx|docx?|pdf|zip|xlsx?)(\?|$)|download|fileDown|atchFile/i.test(l.href + l.text))
    .map((l) => {
      try {
        return { text: l.text, href: new URL(l.href, url).toString() };
      } catch {
        return null;
      }
    })
    .filter((l): l is { text: string; href: string } => !!l && /^https?:/.test(l.href))
    .slice(0, 30);

  // readability는 게시판 상세의 머리 표(기관·신청기간)를 잘라 내는 일이 많다.
  // 메뉴·스크립트만 걷어 낸 본문 전체를 쓰고, 너무 길 때만 readability 결과로 줄인다
  for (const el of document.querySelectorAll("script, style, noscript, nav, footer, iframe, svg")) el.remove();
  // 표 칸이 붙지 않게 칸 끝마다 공백
  const body = cleanText((document.body?.innerHTML ?? "").replace(/<\/(td|th|dt|dd)>/gi, " $&")) ?? "";
  let text = body;
  let title = pageTitle;
  if (body.length > 60_000) {
    const article = new Readability(document as unknown as Document).parse();
    text = cleanText(article?.content ?? "") ?? body;
    title = cleanText(article?.title ?? "") ?? pageTitle;
  }
  return { url, title, text, links };
}
