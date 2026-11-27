"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { addBoard, type SourceState } from "@/app/(app)/announcements/sources/actions";
import { Field, FormMessage, TextInput } from "@/components/form/fields";
import { buttonClass } from "@/components/ui/Button";
import { submitWith } from "@/components/form/useFormAction";

/** 게시판 연결: 기관 홈페이지의 공고 목록 주소 + (선택) 이름. 연결되면 소스 목록으로 */
export function AddBoardForm() {
  const [state, action, pending] = useActionState<SourceState, FormData>(addBoard, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.push("/announcements/sources");
    }
  }, [state, router]);
  const e = state?.errors ?? {};

  return (
    <form ref={formRef} action={action} onSubmit={submitWith(action)} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px] leading-[1.45] font-bold">게시판 연결</h2>
        <p className="m-0 text-[14px] leading-[1.6] text-ink-3">기관 홈페이지의 공고 목록 주소를 넣으면 매일 아침 새 글을 확인해서 지원사업 공고만 가져와요.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_240px]">
        <Field label="게시판 주소" name="url" error={e.url} help="예: 부산테크노파크 사업공고 목록 페이지">
          <TextInput name="url" type="url" placeholder="https://" required invalid={!!e.url} aria-describedby={e.url ? "url-error" : "url-help"} />
        </Field>
        <Field label="이름" name="name" help="비워 두면 페이지 제목으로">
          <TextInput name="name" maxLength={80} placeholder="부산TP 사업공고" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full md:w-auto")}>
            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
            {pending ? "게시판 여는 중" : "연결하기"}
          </button>
          {state && !state.errors ? <FormMessage state={state} /> : null}
        </div>
        <Link href="/announcements/new" className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:text-accent-hover">
          공고 한 건만 넣으려면 주소로 추가
          <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
        </Link>
      </div>
    </form>
  );
}
