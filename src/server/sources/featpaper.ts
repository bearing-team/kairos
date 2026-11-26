// 피트페이퍼(featpaper.com) 공유 링크 → 원본 PDF + 페이지별 링크.
// 공식 API가 아니라 뷰어가 쓰는 주소다 (2026-11 확인, fixtures/newsletters/). 바뀌면 여기서 깨지고 화면에 이유가 뜬다.
import { parseHTML } from "linkedom";
import { assertPublicHost, fetchHtml } from "@/server/sources/fetchPage";
import { downloadFile } from "@/server/drafting/download";
import type { PdfLink } from "@/server/sources/newsletterPdf";
import { SourceError } from "@/server/sources/types";

export const isFeatpaper = (url: string) => {
  try {
    return /(^|\.)featpaper\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
};

export type FeatpaperMeta = { url: string; key: string; title: string | null; uuid: string };

/** 공유 페이지 HTML → 문서 코드(og:url)·제목·PDF uuid(og:image) */
export function readFeatpaperPage(html: string, pageUrl: string): FeatpaperMeta {
  const { document } = parseHTML(html);
  const og = (p: string) => document.querySelector(`meta[property="og:${p}"]`)?.getAttribute("content")?.trim() || null;
  const url = og("url") ?? pageUrl;
  const key = url.match(/featpaper\.com\/(?:l|u)\/([\w/-]+)/)?.[1]?.replace(/\/$/, "") ?? null;
  const uuid = og("image")?.match(/\/pdf\/([0-9a-f-]{36})\//)?.[1] ?? null;
  if (!key || !uuid) throw new SourceError("newsletter", "피트페이퍼 문서 정보를 찾지 못했어요. 공유 링크가 맞는지 확인해 주세요");
  return { url, key, title: og("title")?.replace(/_/g, " ") ?? null, uuid };
}

async function api<T>(path: string): Promise<T> {
  const url = new URL(path, "https://featpaper.com");
  await assertPublicHost(url);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; kairos/0.1)" } });
  if (!res.ok) throw new SourceError("newsletter", `피트페이퍼 응답 오류 (HTTP ${res.status})`);
  const body = (await res.json()) as { data?: T };
  if (!body?.data) throw new SourceError("newsletter", "피트페이퍼 응답 형식이 바뀌었어요");
  return body.data;
}

export async function fetchFeatpaper(shareUrl: string): Promise<FeatpaperMeta & { pdfSrc: string; pdf: Uint8Array; links: Record<string, PdfLink[]> }> {
  const page = await fetchHtml(shareUrl);
  const meta = readFeatpaperPage(page.html, page.url);
  const [file, ann] = await Promise.all([
    api<{ pdfSrc?: string }>(`/api/pdf/resource-file/${meta.uuid}`),
    api<{ annotations?: Record<string, PdfLink[]> }>(`/api/pdf/annotations/${meta.uuid}`),
  ]);
  if (!file.pdfSrc) throw new SourceError("newsletter", "피트페이퍼에서 PDF 주소를 받지 못했어요");
  const { buf } = await downloadFile(file.pdfSrc, meta.url);
  return { ...meta, pdfSrc: file.pdfSrc, pdf: buf, links: ann.annotations ?? {} };
}
