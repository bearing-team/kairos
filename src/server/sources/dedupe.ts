import { createHash } from "node:crypto";
import { normalizeTitle } from "./text";
import type { NormalizedAnnouncement } from "./types";

/** 소스 간 병합 키: normalize(title) | 기관 | 마감일(KST) */
export function dedupeKey(a: Pick<NormalizedAnnouncement, "title" | "organization" | "applyEnd">): string {
  const org = (a.organization ?? "").normalize("NFKC").replace(/\s+/g, "");
  const end = a.applyEnd ? new Date(a.applyEnd.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10) : "";
  return `${normalizeTitle(a.title)}|${org}|${end}`;
}

/** 화면·매칭에 쓰는 필드가 바뀌었는지 보는 해시 (raw는 제외: 조회수 같은 값이 매번 바뀜) */
export function contentHash(a: NormalizedAnnouncement): string {
  const { raw: _raw, ...rest } = a;
  void _raw;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex").slice(0, 32);
}
