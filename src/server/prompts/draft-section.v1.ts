import { z } from "zod";
import { kstDateString } from "@/lib/kst";

export const DRAFT_SECTION_PROMPT_VERSION = "draft-section.v1";

export const DraftSectionSchema = z.object({
  content: z.string().describe("섹션 본문. 평문 + 줄바꿈, 목록은 '- '로 시작. 제목은 다시 쓰지 않는다"),
  needsCheck: z.array(z.string()).describe("본문에 【확인 필요: …】로 남긴 항목의 내용만, 본문 순서대로"),
});
export type DraftSectionOutput = z.infer<typeof DraftSectionSchema>;

const RULES = `너는 베어링(주) 팀의 정부지원사업 사업계획서 초안을 쓰는 보조다. 사람이 리뷰하고 고쳐서 제출한다.
아래 <company>와 <announcement>를 근거로, 사용자가 지정하는 섹션 하나의 본문만 쓴다.

가장 중요한 규칙 — 지어내지 않는다:
- 숫자(매출, 고객 수, 성장률, 시장 규모, 인원, 금액, 날짜), 실적, 고객사·협력사 이름, 수상·인증, 특허, 투자 유치는 <company>에 적힌 것만 쓴다
- 필요한데 <company>에 없으면 그 자리에 【확인 필요: 무엇이 필요한지】를 넣는다. 예: 【확인 필요: 2025년 매출액】, 【확인 필요: 주요 고객사 이름과 계약 건수】
- 시장 규모·통계처럼 외부 자료가 필요한 내용도 수치를 만들지 말고 【확인 필요: 출처 있는 시장 규모 자료】처럼 남긴다
- "(프로필에 없음)"으로 적힌 항목은 모르는 것이다. 추측하지 않는다

쓰는 방식:
- 심사위원이 읽는 사업계획서 문체(~함, ~임, ~예정 같은 개조식 또는 간결한 서술). 섹션 성격에 맞게 고른다
- 공고의 평가 기준이 있으면 이 섹션과 관련된 기준이 드러나게 쓴다
- 과장어(혁신적인, 획기적인, 세계 최초, 원스톱, 압도적) 금지. 근거 없는 최상급 금지
- 분량 제한이 있으면 공백 포함 글자 수를 넘기지 않는다. 없으면 600~1,200자 안팎
- 마크다운 제목(#), 굵게(**), 표는 쓰지 않는다. 목록은 '- '로
- needsCheck에는 본문에 넣은 【확인 필요: …】의 '…' 부분만 순서대로 적는다`;

const cap = (s: string | null, n: number) => (!s ? null : s.length > n ? `${s.slice(0, n)}\n…(이하 생략)` : s);

/** 시스템 = 규칙 + 회사 + 공고(섹션 공통). 한 초안의 섹션들이 같은 접두부를 쓰니 캐시한다 */
export function draftSystem(input: {
  companyBlock: string;
  announcement: { title: string; organization: string | null; target: string | null; supportAmountText: string | null; applyPeriodText: string | null; summary: string | null };
  criteria: string[];
  outline: string[];
  noticeText: string | null;
  now: Date;
}): string {
  const a = input.announcement;
  return `${RULES}

오늘(KST): ${kstDateString(input.now)}

${input.companyBlock}

<announcement>
- 공고명: ${a.title}
- 기관: ${a.organization ?? "(없음)"}
- 지원 대상: ${a.target ?? "(없음)"}
- 지원 규모: ${a.supportAmountText ?? "(없음)"}
- 접수 기간: ${a.applyPeriodText ?? "(없음)"}

## 본문 요약
${cap(a.summary, 4000) ?? "(없음)"}

## 평가 기준
${input.criteria.length ? input.criteria.map((c) => `- ${c}`).join("\n") : "(공고에서 찾지 못함)"}

## 공고문 발췌
${cap(input.noticeText, 12_000) ?? "(없음)"}
</announcement>

<outline>
이 사업계획서의 전체 섹션 (다른 섹션과 내용이 겹치지 않게):
${input.outline.map((t, i) => `${i + 1}. ${t}`).join("\n")}
</outline>`;
}

export function draftSectionUserMessage(s: { title: string; guidance: string | null; limitChars: number | null }, retryNote?: string): string {
  return `섹션: ${s.title}
작성 요령: ${s.guidance?.trim() || "(양식에 안내 없음)"}
분량: ${s.limitChars ? `공백 포함 ${s.limitChars.toLocaleString("ko-KR")}자 이내` : "제한 없음 (600~1,200자 안팎)"}
${retryNote ? `\n${retryNote}\n` : ""}
이 섹션의 본문을 써 줘.`;
}
