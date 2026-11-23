import { prisma } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { contentHash, dedupeKey } from "./dedupe";
import type { NormalizedAnnouncement } from "./types";

export type UpsertResult = { created: number; updated: number; unchanged: number; createdIds: string[]; changedIds: string[] };

/**
 * source+externalId 기준 upsert → 다른 소스의 같은 공고면 duplicateOfId로 묶는다.
 * createdIds/changedIds는 M2에서 match:score 큐에 넣을 대상
 */
export async function upsertAnnouncements(items: NormalizedAnnouncement[], now = new Date()): Promise<UpsertResult> {
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, createdIds: [], changedIds: [] };

  for (const item of items) {
    const hash = contentHash(item);
    const key = dedupeKey(item);
    const { attachments, raw, ...fields } = item;
    const data = { ...fields, raw: raw as Prisma.InputJsonValue, contentHash: hash, dedupeKey: key, lastSeenAt: now };

    const existing = await prisma.announcement.findUnique({
      where: { source_externalId: { source: item.source, externalId: item.externalId } },
      select: { id: true, contentHash: true },
    });

    let id: string;
    if (!existing) {
      const canonical = await prisma.announcement.findFirst({
        where: { dedupeKey: key, source: { not: item.source }, duplicateOfId: null },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      const created = await prisma.announcement.create({ data: { ...data, duplicateOfId: canonical?.id ?? null } });
      id = created.id;
      result.created++;
      result.createdIds.push(id);
    } else if (existing.contentHash !== hash) {
      await prisma.announcement.update({ where: { id: existing.id }, data });
      id = existing.id;
      result.updated++;
      result.changedIds.push(id);
    } else {
      await prisma.announcement.update({ where: { id: existing.id }, data: { lastSeenAt: now, raw: data.raw } });
      id = existing.id;
      result.unchanged++;
    }

    for (const att of attachments) {
      await prisma.attachment.upsert({
        where: { announcementId_url: { announcementId: id, url: att.url } },
        create: { announcementId: id, ...att },
        update: { fileName: att.fileName, kind: att.kind },
      });
    }
  }
  return result;
}
