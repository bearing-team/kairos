"use client";

import { useState } from "react";
import { Check, Globe, Newspaper } from "lucide-react";
import { AddBoardForm } from "@/components/sources/AddBoardForm";
import { AddNewsletterForm } from "@/components/sources/AddNewsletterForm";

export type SourceKind = "board" | "newsletter";

const KINDS: { key: SourceKind; icon: typeof Globe; title: string; desc: string }[] = [
  { key: "board", icon: Globe, title: "기관 게시판", desc: "공고 목록 주소를 넣으면 매일 아침 새 글을 확인해요" },
  { key: "newsletter", icon: Newspaper, title: "뉴스레터", desc: "메일로 받은 링크를 넣으면 안의 공고를 모두 가져와요" },
];

/** 소스 종류 고르기 + 고른 종류의 연결 폼. 새 종류는 KINDS에 더한다 */
export function ConnectSource({ initial }: { initial: SourceKind }) {
  const [kind, setKind] = useState<SourceKind>(initial);
  return (
    <>
      <fieldset className="m-0 grid grid-cols-1 gap-3 border-0 p-0 md:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold text-ink">어떤 소스를 연결할까요?</legend>
        {KINDS.map(({ key, icon: Icon, title, desc }) => {
          const on = kind === key;
          return (
            <label
              key={key}
              className={`relative flex cursor-pointer items-start gap-4 rounded-xl border bg-surface p-5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                on ? "border-accent" : "border-line hover:bg-surface-subtle"
              }`}
            >
              <input type="radio" name="kind" value={key} checked={on} onChange={() => setKind(key)} className="sr-only" />
              <span aria-hidden="true" className={`flex size-10 flex-none items-center justify-center rounded-lg ${on ? "bg-accent-soft text-accent" : "bg-surface-subtle text-ink-2"}`}>
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-col gap-1 pr-6">
                <span className="text-[15px] font-semibold text-ink">{title}</span>
                <span className="text-[13px] leading-[1.6] text-ink-3">{desc}</span>
              </span>
              {on ? (
                <span aria-hidden="true" className="absolute top-5 right-5 flex size-5 items-center justify-center rounded-full bg-accent text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
      {kind === "board" ? <AddBoardForm /> : <AddNewsletterForm />}
    </>
  );
}
