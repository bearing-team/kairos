import "server-only";
import { prisma } from "@/server/db";
import { fillHwp, type FieldValues } from "@/server/docs/hwpForm";
import { getFile } from "@/server/drafting/storage";
import type { FieldMeta } from "@/server/drafting/run";

/** 양식 채우기 초안 → 원본 HWP에 값을 넣은 파일. 원본 양식이 없으면 null */
export async function draftToHwp(draftId: string): Promise<{ buf: Uint8Array; fileName: string; skipped: number } | null> {
  const d = await prisma.draft.findUnique({
    where: { id: draftId },
    select: {
      version: true,
      templateSource: true,
      formAttachment: { select: { fileName: true, fileKey: true } },
      application: { select: { company: { select: { name: true } } } },
      sections: { select: { key: true, content: true, field: true } },
    },
  });
  if (!d || d.templateSource !== "fill" || !d.formAttachment?.fileKey) return null;
  const values: FieldValues = {};
  for (const s of d.sections) {
    const meta = s.field as FieldMeta | null;
    if (!s.content.trim()) continue;
    values[s.key] = meta?.kind === "choice" ? s.content.split(",").map((x) => x.trim()) : s.content;
  }
  const { buf, skipped } = fillHwp(await getFile(d.formAttachment.fileKey), values);
  const base = d.formAttachment.fileName.replace(/\.hwp$/i, "");
  return { buf, fileName: `${base}_${d.application.company.name}_v${d.version}.hwp`, skipped: skipped.length };
}
