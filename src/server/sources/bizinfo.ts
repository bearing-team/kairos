// 기업마당 지원사업정보 API. 명세: docs/sources/bizinfo.md
import { cleanText, splitList } from "./text";
import { parseKstRange } from "./dates";
import { SourceError, type NormalizedAnnouncement } from "./types";

export const BIZINFO_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";

type Item = Record<string, unknown>;

/**
 * JSON 응답에서 공고 배열을 찾는다.
 * 명세에 최상위 키 이름이 없어서, 최상위가 배열이면 그대로, 객체면 pblancId를 가진 객체 배열을 찾는다.
 * 실제 응답으로 키를 확인하면 여기를 좁힌다 (fixtures/bizinfo/).
 */
export function extractBizinfoItems(body: unknown): Item[] {
  const isItems = (v: unknown): v is Item[] =>
    Array.isArray(v) && (v.length === 0 || (typeof v[0] === "object" && v[0] !== null && "pblancId" in v[0]));
  if (isItems(body)) return body;
  if (body && typeof body === "object") {
    for (const v of Object.values(body)) if (isItems(v)) return v;
  }
  throw new SourceError("bizinfo", "응답에서 공고 목록을 찾지 못했어요");
}

export function parseBizinfoItem(item: Item): NormalizedAnnouncement | null {
  const externalId = cleanText(item.pblancId);
  const title = cleanText(item.pblancNm);
  if (!externalId || !title) return null;

  const periodText = cleanText(item.reqstBeginEndDe);
  const { start, end } = parseKstRange(periodText ?? "");

  const attachments: NormalizedAnnouncement["attachments"] = [];
  const printUrl = cleanText(item.printFlpthNm);
  if (printUrl) attachments.push({ url: printUrl, fileName: cleanText(item.printFileNm) ?? "공고문", kind: "notice" });
  const fileUrl = cleanText(item.flpthNm);
  if (fileUrl && fileUrl !== printUrl) attachments.push({ url: fileUrl, fileName: cleanText(item.fileNm) ?? "첨부파일", kind: "other" });

  return {
    source: "bizinfo",
    externalId,
    url: cleanText(item.pblancUrl),
    title,
    organization: cleanText(item.jrsdInsttNm),
    executingOrg: cleanText(item.excInsttNm),
    summary: cleanText(item.bsnsSumryCn),
    target: cleanText(item.trgetNm),
    regionLimit: null, // 별도 필드 없음. 해시태그의 지역은 M2 하드필터에서 판단
    applyStart: start,
    applyEnd: end,
    applyPeriodText: periodText,
    supportAmountText: null,
    category: cleanText(item.pldirSportRealmLclasCodeNm),
    hashtags: splitList(item.hashTags),
    applyUrl: cleanText(item.rceptEngnHmpgUrl),
    attachments,
    raw: item,
  };
}

export function parseBizinfoResponse(body: unknown): NormalizedAnnouncement[] {
  return extractBizinfoItems(body)
    .map(parseBizinfoItem)
    .filter((x): x is NormalizedAnnouncement => x !== null);
}

/** 마감 전 공고 전체를 가져온다 (원본 응답도 돌려줘서 fixture 저장에 쓴다) */
export async function fetchBizinfo(apiKey: string): Promise<{ body: unknown; items: NormalizedAnnouncement[] }> {
  const url = new URL(BIZINFO_URL);
  url.searchParams.set("crtfcKey", apiKey);
  url.searchParams.set("dataType", "json");
  url.searchParams.set("searchCnt", "0"); // 0 = 전체

  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new SourceError("bizinfo", `HTTP ${res.status}`);
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // 키 오류 등은 RSS XML의 reqErr로 온다
    const err = text.match(/<reqErr><!\[CDATA\[(.*?)\]\]><\/reqErr>/)?.[1];
    throw new SourceError("bizinfo", err ?? "JSON이 아닌 응답을 받았어요");
  }
  return { body, items: parseBizinfoResponse(body) };
}
