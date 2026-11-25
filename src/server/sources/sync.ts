import { prisma } from "@/server/db";
import { secret } from "@/server/secrets";
import { fetchBizinfo } from "./bizinfo";
import { fetchKstartup } from "./kstartup";
import { upsertAnnouncements } from "./upsert";
import type { NormalizedAnnouncement } from "./types";

export const API_SOURCES = ["bizinfo", "kstartup"] as const;
export type ApiSource = (typeof API_SOURCES)[number];

export { SOURCE_LABEL } from "@/lib/sources";

/** 소스별 API 키. 없으면 null → 그 소스는 건너뛴다 */
export function sourceKey(source: ApiSource): string | null {
  return secret(source === "bizinfo" ? "BIZINFO_API_KEY" : "DATA_GO_KR_SERVICE_KEY");
}

export async function fetchSource(source: ApiSource, key: string) {
  if (source === "bizinfo") {
    const { body, items } = await fetchBizinfo(key);
    return { bodies: [body], items };
  }
  return fetchKstartup(key);
}

export type SyncSummary = { source: ApiSource; ok: boolean; fetched: number; created: number; updated: number; error?: string; skipped?: boolean };

/** 소스 하나를 가져와 저장하고 SyncRun에 기록. 실패해도 throw하지 않는다(다른 소스는 계속) */
export async function syncSource(source: ApiSource): Promise<SyncSummary> {
  const key = sourceKey(source);
  if (!key) return { source, ok: false, skipped: true, fetched: 0, created: 0, updated: 0, error: "API 키가 없어요" };

  const run = await prisma.syncRun.create({ data: { source } });
  try {
    const { items } = await fetchSource(source, key);
    const r = await upsertAnnouncements(dedupeWithin(items));
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), fetched: items.length, created: r.created, updated: r.updated },
    });
    return { source, ok: true, fetched: items.length, created: r.created, updated: r.updated };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.syncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), error } });
    return { source, ok: false, fetched: 0, created: 0, updated: 0, error };
  }
}

export async function syncAll(sources: readonly ApiSource[] = API_SOURCES): Promise<SyncSummary[]> {
  const out: SyncSummary[] = [];
  for (const s of sources) out.push(await syncSource(s));
  return out;
}

/** 같은 응답 안의 중복 ID 제거 (페이지 경계에서 겹칠 수 있음) */
function dedupeWithin(items: NormalizedAnnouncement[]) {
  const seen = new Map<string, NormalizedAnnouncement>();
  for (const it of items) seen.set(it.externalId, it);
  return [...seen.values()];
}
