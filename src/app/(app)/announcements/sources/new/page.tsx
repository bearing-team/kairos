import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConnectSource, type SourceKind } from "@/components/sources/ConnectSource";
import { KeyButton } from "@/components/settings/KeyButton";
import { requireUser } from "@/server/session";
import { llmConfigured } from "@/server/llm";
import { keyViews } from "@/server/keyViews";

/** 새 소스 연결하기: 종류 고르기(게시판 / 뉴스레터) → 그 종류의 연결 폼 */
export default function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  return (
    <>
      <Link href="/announcements/sources" className="-mb-4 inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={2.2} aria-hidden="true" />
        공고 소스
      </Link>
      <PageHeader eyebrow="게시판이나 뉴스레터를 연결하면 공고를 알아서 가져와요" title="새 소스 연결하기" />
      <Suspense fallback={null}>
        <Connect searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Connect({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await connection();
  await requireUser();
  const [{ type }, keys] = await Promise.all([searchParams, keyViews()]);
  const initial: SourceKind = type === "newsletter" ? "newsletter" : "board";
  return (
    <>
      {!llmConfigured() ? (
        <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--status-review-bg)] px-4 py-3 text-[13px] text-urgent-text">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} strokeWidth={2} aria-hidden="true" />
            게시판 글을 읽으려면 Anthropic API 키가 필요해요. 연결은 먼저 해 둘 수 있어요.
          </span>
          <KeyButton k={keys.views.ANTHROPIC_API_KEY} />
        </div>
      ) : null}
      <ConnectSource initial={initial} />
    </>
  );
}
