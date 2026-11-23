// 첨부 동기화: 상세 페이지에서 새 링크 → 내려받기 → storage 저장 → 글자 뽑기
import { prisma } from "@/server/db";
import { parseDocument, PARSEABLE_EXT, detectFormat } from "@/server/docs";
import { classifyAttachment, detailUrl, fileExt, linksFor, type FoundLink } from "./links";
import { downloadFile, fetchHtml } from "./download";
import { putFile } from "./storage";

export type AttachmentSyncResult = { found: number; downloaded: number; parsed: number; failed: number; notes: string[] };

export async function syncAttachments(announcementId: string): Promise<AttachmentSyncResult> {
  const a = await prisma.announcement.findUniqueOrThrow({
    where: { id: announcementId },
    select: { source: true, externalId: true, url: true, attachments: true },
  });
  const notes: string[] = [];
  const page = detailUrl(a);
  let links: FoundLink[] = [];
  if (page) {
    try {
      links = linksFor(a.source, await fetchHtml(page), page);
    } catch (e) {
      notes.push(`상세 페이지를 열지 못해 저장된 링크로 받았어요 (${e instanceof Error ? e.message : e})`);
    }
  }

  // 같은 이름이면 링크만 새것으로 (기업마당 토큰 만료 대비)
  for (const l of links) {
    const existing = a.attachments.find((x) => x.fileName === l.fileName);
    const guess = classifyAttachment(l.fileName);
    if (existing) {
      if (existing.url !== l.url || (guess !== "other" && existing.kind !== guess)) {
        await prisma.attachment
          .update({ where: { id: existing.id }, data: { url: l.url, kind: guess === "other" ? existing.kind : guess } })
          .catch(() => undefined);
      }
    } else {
      await prisma.attachment
        .create({ data: { announcementId, fileName: l.fileName, url: l.url, kind: guess } })
        .catch(() => undefined); // 같은 url이 이미 있으면 그대로
    }
  }

  const rows = await prisma.attachment.findMany({ where: { announcementId }, orderBy: { createdAt: "asc" } });
  const result: AttachmentSyncResult = { found: rows.length, downloaded: 0, parsed: 0, failed: 0, notes };
  for (const row of rows) {
    if (row.parseStatus === "parsed" && row.fileKey) {
      result.parsed++;
      continue;
    }
    const ext = fileExt(row.fileName);
    if (ext && !PARSEABLE_EXT.includes(ext)) {
      await prisma.attachment.update({ where: { id: row.id }, data: { parseStatus: "failed", parseError: `읽지 않는 형식이에요 (.${ext})` } });
      continue;
    }
    try {
      const { buf, mime } = await downloadFile(row.url, page ?? undefined);
      const format = detectFormat(buf, row.fileName);
      const stored = await putFile(buf, ext || format || "bin");
      result.downloaded++;
      await prisma.attachment.update({
        where: { id: row.id },
        data: { fileKey: stored.key, sha256: stored.sha256, size: buf.length, mime, downloadedAt: new Date() },
      });
      const doc = await parseDocument(buf, row.fileName);
      await prisma.attachment.update({
        where: { id: row.id },
        data: { text: doc.text, parsed: { format: doc.format, chars: doc.text.length }, parseStatus: "parsed", parseError: null },
      });
      result.parsed++;
    } catch (e) {
      result.failed++;
      await prisma.attachment.update({
        where: { id: row.id },
        data: { parseStatus: "failed", parseError: e instanceof Error ? e.message.slice(0, 300) : String(e) },
      });
    }
  }
  return result;
}

type ParsedRow = { id: string; fileName: string; kind: string; text: string | null };

/** 사업계획서 > 계획서 > 신청서 > 그 밖의 양식, 같으면 글자가 많은 것 */
export function rankForms<T extends ParsedRow>(rows: T[]): T[] {
  const rank = (r: T) => {
    const n = r.fileName.replace(/\s+/g, "");
    return /사업계획서/.test(n) ? 0 : /계획서/.test(n) ? 1 : /신청서/.test(n) ? 2 : 3;
  };
  return rows
    .filter((r) => r.kind === "form" && r.text)
    .sort((x, y) => rank(x) - rank(y) || (y.text?.length ?? 0) - (x.text?.length ?? 0));
}
