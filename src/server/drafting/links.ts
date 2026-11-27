// 공고 상세 페이지에서 첨부 링크 찾기. 기업마당 다운로드 링크는 토큰이 있어 시간이 지나면 막힌다
// → 내려받을 때마다 상세 페이지를 다시 열어 새 링크를 얻는다
import { parseHTML } from "linkedom";

export type FoundLink = { fileName: string; url: string };

const BIZINFO_DETAIL = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=";
const KSTARTUP_DETAIL = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=";

export function detailUrl(a: { source: string; externalId: string; url: string | null }): string | null {
  if (a.source === "bizinfo") return BIZINFO_DETAIL + encodeURIComponent(a.externalId);
  if (a.source === "kstartup") return KSTARTUP_DETAIL + encodeURIComponent(a.externalId);
  return a.url;
}

const text = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const abs = (href: string, base: string) => {
  try {
    const u = new URL(href, base);
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
};

/** 기업마당: <li><div class="file_name">이름</div> … <a href="/cmm/fms/fileDown.do?…">다운로드</a></li> */
export function bizinfoLinks(html: string, base: string): FoundLink[] {
  const { document } = parseHTML(html);
  const out: FoundLink[] = [];
  for (const li of document.querySelectorAll("li")) {
    const name = text(li.querySelector(".file_name")?.textContent);
    const href = li.querySelector('a[href*="fileDown.do"]')?.getAttribute("href");
    const url = href ? abs(href, base) : null;
    if (name && url) out.push({ fileName: name, url });
  }
  return out;
}

/** K-Startup: <li><a class="file_bg" title="[첨부파일] 이름">…</a> … <a href="/afile/fileDownload/…">다운로드</a></li> */
export function kstartupLinks(html: string, base: string): FoundLink[] {
  const { document } = parseHTML(html);
  const out: FoundLink[] = [];
  for (const li of document.querySelectorAll(".board_file li")) {
    const a = li.querySelector("a.file_bg");
    const name = text(a?.getAttribute("title")?.replace(/^\[첨부파일\]\s*/, "") || a?.textContent);
    const href = li.querySelector('a[href*="/afile/fileDownload/"]')?.getAttribute("href");
    const url = href ? abs(href, base) : null;
    if (name && url) out.push({ fileName: name, url });
  }
  return out;
}

/** 그 밖의 페이지: 확장자가 보이는 링크 */
export function genericLinks(html: string, base: string): FoundLink[] {
  const { document } = parseHTML(html);
  const out: FoundLink[] = [];
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    const name = text(a.getAttribute("title") || a.textContent);
    const m = (href + " " + name).match(/[^\s/\\?=&]+\.(hwpx?|docx|pdf)\b/i);
    const url = abs(href, base);
    if (m && url) out.push({ fileName: name && /\.(hwpx?|docx|pdf)$/i.test(name) ? name : decodeURIComponent(m[0]), url });
  }
  return out;
}

export function linksFor(source: string, html: string, base: string): FoundLink[] {
  const found = source === "bizinfo" ? bizinfoLinks(html, base) : source === "kstartup" ? kstartupLinks(html, base) : genericLinks(html, base);
  const seen = new Set<string>();
  return found.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true))).slice(0, 30);
}

export const fileExt = (name: string) => name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? "";

/** 이름으로 첨부 종류 추정. 양식이 공고문보다 먼저 (예: "공고문 및 신청서 양식"은 양식) */
export function classifyAttachment(name: string): "notice" | "form" | "other" {
  const n = name.replace(/\s+/g, "");
  if (/양식|서식|신청서|계획서|제출서류|별지|별첨|의향서|동의서|확인서|서약서|참가신청/.test(n)) return "form";
  if (/공고/.test(n)) return "notice";
  return "other";
}
