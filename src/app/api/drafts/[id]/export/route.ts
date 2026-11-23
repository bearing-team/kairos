import { requireUser } from "@/server/session";
import { loadExportDoc } from "@/server/export/load";
import { exportFileName, toDocx, toMarkdown } from "@/server/export/format";

const disposition = (name: string) => `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format");
  const doc = await loadExportDoc(id);
  if (!doc) return new Response("Not found", { status: 404 });
  if (format === "md") {
    return new Response(toMarkdown(doc), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": disposition(exportFileName(doc, "md")) } });
  }
  if (format === "docx") {
    const buf = await toDocx(doc);
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": disposition(exportFileName(doc, "docx")) },
    });
  }
  return new Response("format은 docx 또는 md", { status: 400 });
}
