import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { getFile } from "@/server/drafting/storage";

/** 저장해 둔 첨부 내려받기 (원본 링크는 만료될 수 있다) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const a = await prisma.attachment.findUnique({ where: { id }, select: { fileName: true, fileKey: true, mime: true } });
  if (!a?.fileKey) return new Response("Not found", { status: 404 });
  const buf = await getFile(a.fileKey).catch(() => null);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(buf), {
    headers: {
      "content-type": a.mime && !a.mime.startsWith("text/") ? a.mime : "application/octet-stream",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "x-content-type-options": "nosniff",
    },
  });
}
