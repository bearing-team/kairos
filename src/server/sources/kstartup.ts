// K-Startup 지원사업 공고 (공공데이터포털 15125364). 명세: docs/sources/kstartup.md
import { cleanText } from "./text";
import { parseKstDate } from "./dates";
import { SourceError, type NormalizedAnnouncement } from "./types";

export const KSTARTUP_URL =
  "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";

type Item = Record<string, unknown>;
type Page = { items: Item[]; totalCount: number | null };

/** swagger상 data가 배열 또는 { data: [] }로 적혀 있어 둘 다 받는다 */
export function extractKstartupPage(body: unknown): Page {
  if (!body || typeof body !== "object") throw new SourceError("kstartup", "빈 응답을 받았어요");
  const b = body as Record<string, unknown>;
  let data = b.data;
  if (data && !Array.isArray(data) && typeof data === "object") data = (data as Record<string, unknown>).data;
  if (!Array.isArray(data)) throw new SourceError("kstartup", "응답에서 공고 목록(data)을 찾지 못했어요");
  const total = Number(b.totalCount ?? b.matchCount);
  return { items: data as Item[], totalCount: Number.isFinite(total) ? total : null };
}

const NATIONWIDE = new Set(["전국", "전체", ""]);

export function parseKstartupItem(item: Item): NormalizedAnnouncement | null {
  const externalId = cleanText(item.pbanc_sn);
  const title = cleanText(item.biz_pbanc_nm);
  if (!externalId || !title) return null;

  const region = cleanText(item.supt_regin);
  const startRaw = cleanText(item.pbanc_rcpt_bgng_dt);
  const endRaw = cleanText(item.pbanc_rcpt_end_dt);
  const supervising = cleanText(item.sprv_inst);
  const agency = cleanText(item.pbanc_ntrp_nm);

  const target = [cleanText(item.aply_trgt), cleanText(item.aply_trgt_ctnt)].filter(Boolean).join("\n") || null;

  return {
    source: "kstartup",
    externalId,
    url: cleanText(item.biz_aply_url) ?? cleanText(item.biz_gdnc_url),
    title,
    organization: supervising ?? agency,
    executingOrg: agency && agency !== supervising ? agency : null,
    summary: cleanText(item.pbanc_ctnt),
    target,
    regionLimit: region && !NATIONWIDE.has(region) ? region : null,
    applyStart: parseKstDate(startRaw),
    applyEnd: parseKstDate(endRaw),
    applyPeriodText: startRaw || endRaw ? `${startRaw ?? ""} ~ ${endRaw ?? ""}` : null,
    supportAmountText: null,
    category: cleanText(item.supt_biz_clsfc),
    hashtags: [],
    applyUrl: cleanText(item.detl_pg_url),
    attachments: [],
    raw: item,
  };
}

export function parseKstartupResponse(body: unknown): NormalizedAnnouncement[] {
  return extractKstartupPage(body)
    .items.map(parseKstartupItem)
    .filter((x): x is NormalizedAnnouncement => x !== null);
}

/** 모집 중(rcrt_prgs_yn=Y) 공고를 페이지 끝까지 가져온다 */
export async function fetchKstartup(
  serviceKey: string,
  { perPage = 100, maxPages = 50 } = {},
): Promise<{ bodies: unknown[]; items: NormalizedAnnouncement[] }> {
  const bodies: unknown[] = [];
  const items: NormalizedAnnouncement[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(KSTARTUP_URL);
    // 공공데이터포털 키는 이미 인코딩된 형태로 발급되는 경우가 있어 디코딩 후 넣는다
    url.searchParams.set("serviceKey", decodeURIComponent(serviceKey));
    url.searchParams.set("page", String(page));
    url.searchParams.set("perPage", String(perPage));
    url.searchParams.set("returnType", "json");
    url.searchParams.set("cond[rcrt_prgs_yn::EQ]", "Y");

    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    if (!res.ok) throw new SourceError("kstartup", `HTTP ${res.status}: ${text.slice(0, 200)}`);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new SourceError("kstartup", `JSON이 아닌 응답: ${text.slice(0, 200)}`);
    }
    bodies.push(body);
    const { items: pageItems, totalCount } = extractKstartupPage(body);
    for (const it of pageItems) {
      const n = parseKstartupItem(it);
      if (n) items.push(n);
    }
    if (pageItems.length < perPage) break;
    if (totalCount !== null && page * perPage >= totalCount) break;
  }
  return { bodies, items };
}
