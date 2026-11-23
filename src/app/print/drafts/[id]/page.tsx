import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireUser } from "@/server/session";
import { loadExportDoc } from "@/server/export/load";
import { splitChecks } from "@/lib/needsCheck";
import { PrintButton } from "./PrintButton";

// 인쇄용 화면 → 브라우저 인쇄에서 "PDF로 저장" (한글 글꼴을 따로 넣지 않아도 된다)
export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Doc params={params} />
    </Suspense>
  );
}

async function Doc({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await requireUser();
  const { id } = await params;
  const d = await loadExportDoc(id);
  if (!d) notFound();
  return (
    <main className="mx-auto max-w-[760px] bg-white px-6 py-10 text-ink print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 18mm 16mm; } @media print { body { background: #fff; } .no-print { display: none !important; } }`}</style>
      <div className="no-print mb-8 flex items-center justify-between gap-3 rounded-xl bg-surface-subtle p-4 text-[14px] text-ink-2">
        <span>인쇄 창에서 대상을 &lsquo;PDF로 저장&rsquo;으로 고르면 PDF가 돼요.</span>
        <PrintButton />
      </div>
      <h1 className="m-0 text-[26px] leading-[1.35] font-extrabold">{d.title}</h1>
      <p className="m-0 mt-2 mb-8 text-[13px] text-ink-3">
        {d.company} · 사업계획서 초안 v{d.version} · {d.date}
      </p>
      {d.sections.map((s, i) => (
        <section key={i} className="mb-8 break-inside-auto">
          <h2 className="m-0 mb-3 text-[18px] font-bold break-after-avoid">
            {i + 1}. {s.title}
          </h2>
          <div className="text-[14px] leading-[1.8] whitespace-pre-wrap">
            {s.content.trim()
              ? splitChecks(s.content).map((p, k) =>
                  p.check ? (
                    <mark key={k} className="rounded-[4px] bg-check-bg px-0.5 font-semibold text-check-fg print:bg-[#FFF6D6]">
                      {p.text}
                    </mark>
                  ) : (
                    <span key={k}>{p.text}</span>
                  ),
                )
              : "(비어 있음)"}
          </div>
        </section>
      ))}
    </main>
  );
}
