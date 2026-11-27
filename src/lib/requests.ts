// 구성원 요청 표기 (화면·Slack 공통, 순수)
export type RequestKind = "write" | "supplement" | "review" | "other";
export type RequestStatus = "open" | "done" | "declined" | "canceled";

export const REQUEST_KINDS: RequestKind[] = ["write", "supplement", "review", "other"];

/** 칩·선택지에 쓰는 이름과 Slack 문장용 목적어(조사 포함) */
export const REQUEST_KIND: Record<RequestKind, { label: string; verb: string; hint: string }> = {
  write: {
    label: "작성 요청",
    verb: "작성을",
    hint: "비어 있는 섹션이나 새 내용을 써 달라고",
  },
  supplement: {
    label: "보강 요청",
    verb: "보강을",
    hint: "이미 쓴 내용에 숫자·근거·사례를 더해 달라고",
  },
  review: {
    label: "리뷰 요청",
    verb: "리뷰를",
    hint: "읽어 보고 코멘트를 달아 달라고 (리뷰어로도 지정돼요)",
  },
  other: {
    label: "기타 요청",
    verb: "확인을",
    hint: "서류 준비 등 그 밖의 일",
  },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: "open" | "done" | "muted" }> = {
  open: { label: "진행 중", tone: "open" },
  done: { label: "완료", tone: "done" },
  declined: { label: "거절", tone: "muted" },
  canceled: { label: "취소", tone: "muted" },
};

export const isRequestKind = (v: unknown): v is RequestKind => typeof v === "string" && (REQUEST_KINDS as string[]).includes(v);

/** 요청이 가리키는 초안 위치 (섹션이 이전 버전이면 그 버전으로) */
export function requestHref(applicationId: string, section: { order: number; draft: { version: number } } | null) {
  if (!section) return `/applications/${applicationId}/draft`;
  return `/applications/${applicationId}/draft?v=${section.draft.version}#sec-${section.order}`;
}
