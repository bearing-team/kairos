import { Suspense } from "react";
import { PageHeader, PageHeaderSkeleton } from "@/components/layout/PageHeader";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestCard } from "@/components/requests/RequestCard";
import { toRequestView } from "@/components/requests/view";
import { requireUser } from "@/server/session";
import { listRequests } from "@/server/requests";

export const metadata = { title: "요청 · Kairos" };

type SP = Promise<{ box?: string; state?: string }>;

export default function RequestsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<PageHeaderSkeleton />}>
      <Requests searchParams={searchParams} />
    </Suspense>
  );
}

async function Requests({ searchParams }: { searchParams: SP }) {
  const me = await requireUser();
  const sp = await searchParams;
  const box = sp.box === "sent" ? "sent" : "received";
  const state = sp.state === "closed" ? "closed" : "open";
  const { rows, counts } = await listRequests(me, box, state);
  const now = new Date();
  const views = rows.map((r) => toRequestView(r, me.id, now));
  const href = (b: string, s: string) => `/requests?box=${b}${s === "closed" ? "&state=closed" : ""}`;

  return (
    <>
      <PageHeader eyebrow="같은 회사 구성원과 주고받는 작성·보강·리뷰 요청" title="요청" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LinkTabs
          label="요청함"
          current={box}
          items={[
            { key: "received", label: `받은 요청${counts.received ? ` ${counts.received}` : ""}`, href: href("received", state) },
            { key: "sent", label: `보낸 요청${counts.sent ? ` ${counts.sent}` : ""}`, href: href("sent", state) },
          ]}
        />
        <LinkTabs
          label="상태"
          current={state}
          items={[
            { key: "open", label: "진행 중", href: href(box, "open") },
            { key: "closed", label: "끝난 요청", href: href(box, "closed") },
          ]}
        />
      </div>

      {views.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {views.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={state === "closed" ? "끝난 요청이 없어요" : box === "received" ? "지금 나에게 온 요청이 없어요" : "진행 중인 보낸 요청이 없어요"}
          description={box === "sent" && state === "open" ? "초안 화면 오른쪽의 ‘구성원에게 요청하기’로 작성·보강·리뷰를 부탁할 수 있어요." : undefined}
        />
      )}
    </>
  );
}
