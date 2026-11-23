import { z } from "zod";

export const URL_EXTRACT_PROMPT_VERSION = "url-extract.v1";

/** LLM이 돌려줄 공고 필드. 페이지에 없는 값은 null */
export const UrlExtractSchema = z.object({
  isAnnouncement: z.boolean().describe("이 페이지가 지원사업·모집 공고인지"),
  title: z.string().nullable().describe("공고명. 페이지에 적힌 그대로"),
  organization: z.string().nullable().describe("소관·주관 기관"),
  executingOrg: z.string().nullable().describe("수행·운영 기관 (주관과 다를 때만)"),
  summary: z.string().nullable().describe("지원 내용 요약, 600자 이내, 페이지 내용만"),
  target: z.string().nullable().describe("지원(신청) 대상과 자격 요건"),
  regionLimit: z.string().nullable().describe("지역 제한 (예: 부산). 전국이거나 언급 없으면 null"),
  applyStart: z.string().nullable().describe("접수 시작일 YYYY-MM-DD"),
  applyEnd: z.string().nullable().describe("접수 마감일 YYYY-MM-DD"),
  applyPeriodText: z.string().nullable().describe("접수 기간 원문 (예: 2026.11.20 ~ 2026.12.08 18:00, 상시)"),
  supportAmountText: z.string().nullable().describe("지원 규모 원문 (예: 최대 1억원)"),
  category: z.string().nullable().describe("지원 분야 (예: 사업화, 기술개발, 마케팅)"),
  applyUrl: z.string().nullable().describe("신청 페이지 URL (본문에 있을 때만)"),
});
export type UrlExtract = z.infer<typeof UrlExtractSchema>;

export const URL_EXTRACT_SYSTEM = `너는 한국 정부·지자체·진흥원 지원사업 공고 페이지에서 정보를 뽑아 정리한다.
규칙:
- 아래 페이지 본문에 실제로 적힌 내용만 쓴다. 추측하거나 일반 상식으로 채우지 않는다.
- 본문에 없는 항목은 null로 둔다.
- 날짜는 YYYY-MM-DD로 바꾼다. 연도가 없으면 본문 맥락(공고 연도)에서 분명할 때만 채우고, 아니면 null.
- 요약은 과장 없이 사실만, 600자 이내.
- 지원사업 공고가 아닌 페이지면 isAnnouncement를 false로 한다.`;

export function urlExtractUserMessage(page: { url: string; title: string | null; text: string }) {
  // 본문이 매우 길면 앞부분만 쓴다 (공고 페이지는 핵심이 앞에 있음). 잘랐다는 사실을 함께 알린다
  const LIMIT = 60_000;
  const truncated = page.text.length > LIMIT;
  return `URL: ${page.url}
페이지 제목: ${page.title ?? "(없음)"}
${truncated ? `(본문이 길어 앞 ${LIMIT}자만 포함)\n` : ""}
<page>
${page.text.slice(0, LIMIT)}
</page>`;
}
