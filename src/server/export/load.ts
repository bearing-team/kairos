import "server-only";
import { prisma } from "@/server/db";
import { kstDateString } from "@/lib/kst";
import type { ExportDoc } from "./format";

export async function loadExportDoc(draftId: string): Promise<(ExportDoc & { applicationId: string }) | null> {
  const d = await prisma.draft.findUnique({
    where: { id: draftId },
    select: {
      version: true,
      applicationId: true,
      sections: { orderBy: { order: "asc" }, select: { title: true, content: true } },
      application: { select: { company: { select: { name: true } }, announcement: { select: { title: true } } } },
    },
  });
  if (!d) return null;
  return {
    applicationId: d.applicationId,
    title: d.application.announcement.title,
    company: d.application.company.name,
    version: d.version,
    date: kstDateString(new Date()),
    sections: d.sections,
  };
}
