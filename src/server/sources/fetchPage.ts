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

/** 페이지를 받아 본문 텍스트(readability)와 첨부로 보이는 링크를 뽑는다 */
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const url = new URL(normalizeUrl(rawUrl));
  await assertPublicHost(url);
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; grant-desk/0.1)", accept: "text/html,*/*" },
  });
  if (!res.ok) throw new Error(`페이지를 열지 못했어요 (HTTP ${res.status})`);
  const finalUrl = new URL(res.url || url.toString());
  await assertPublicHost(finalUrl);
  const html = (await res.text()).slice(0, 2_000_000);

  const { document } = parseHTML(html);
  const pageTitle = cleanText(document.querySelector("title")?.textContent ?? "");
  const links = [...document.querySelectorAll("a[href]")]
    .map((a) => ({ text: cleanText(a.textContent ?? "") ?? "", href: a.getAttribute("href") ?? "" }))
    .filter((l) => /\.(hwp|hwpx|docx?|pdf|zip|xlsx?)(\?|$)|download|fileDown|atchFile/i.test(l.href + l.text))
    .map((l) => {
      try {
        return { text: l.text, href: new URL(l.href, finalUrl).toString() };
      } catch {
        return null;
      }
    })
    .filter((l): l is { text: string; href: string } => !!l && /^https?:/.test(l.href))
    .slice(0, 30);

  const article = new Readability(document as unknown as Document).parse();
  const text = cleanText(article?.textContent ?? document.body?.textContent ?? "") ?? "";
  return { url: finalUrl.toString(), title: cleanText(article?.title ?? "") ?? pageTitle, text, links };
}
