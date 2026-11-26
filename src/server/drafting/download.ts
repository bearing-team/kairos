// 첨부 내려받기: 내부망 차단 + 리다이렉트마다 다시 검사 + 크기 제한
import { assertPublicHost } from "@/server/sources/fetchPage";

export const MAX_FILE_BYTES = 30 * 1024 * 1024;
const UA = "Mozilla/5.0 (compatible; kairos/0.1)";

async function safeFetch(rawUrl: string, init: { referer?: string; accept: string }): Promise<Response> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("http(s) 주소만 받을 수 있어요");
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
      headers: { "user-agent": UA, accept: init.accept, ...(init.referer ? { referer: init.referer } : {}) },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url);
      continue;
    }
    return res;
  }
  throw new Error("리다이렉트가 너무 많아요");
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await safeFetch(url, { accept: "text/html,*/*" });
  if (!res.ok) throw new Error(`상세 페이지를 열지 못했어요 (HTTP ${res.status})`);
  return (await res.text()).slice(0, 3_000_000);
}

export async function downloadFile(url: string, referer?: string): Promise<{ buf: Uint8Array; mime: string | null }> {
  const res = await safeFetch(url, { referer, accept: "*/*" });
  if (!res.ok) throw new Error(`내려받지 못했어요 (HTTP ${res.status})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_FILE_BYTES) throw new Error("파일이 30MB보다 커요");
  const mime = res.headers.get("content-type");
  if (mime?.startsWith("text/html")) throw new Error("파일 대신 웹페이지가 왔어요 (링크가 만료됐을 수 있어요)");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("내용이 비어 있어요");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_FILE_BYTES) {
      await reader.cancel();
      throw new Error("파일이 30MB보다 커요");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.length;
  }
  return { buf, mime };
}
