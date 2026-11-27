import { z } from "zod";

export const FORM_FILL_PROMPT_VERSION = "form-fill.v1";

/** 양식 칸마다 값. 모르면 빈 값 + needsCheck (HWP에 【확인 필요】 글자가 들어가지 않게) */
export const FormFillSchema = z.object({
  fields: z.array(
    z.object({
      id: z.string().describe("입력으로 받은 칸 id 그대로"),
      value: z.string().describe("text 칸: 넣을 값. 근거가 없으면 빈 문자열. choice 칸: 빈 문자열"),
      selected: z.array(z.string()).describe("choice 칸: 고른 보기 (options에 있는 글자 그대로). text 칸: 빈 배열"),
      needsCheck: z.string().describe("사람이 확인하거나 채워야 할 것 한 줄 (예: '담당자 휴대전화가 프로필에 없음'). 없으면 빈 문자열"),
    }),
  ),
});
export type FormFill = z.infer<typeof FormFillSchema>;

export type FillFieldInput = { id: string; label: string; kind: "text" | "choice"; options: string[]; multi: boolean; hint: string | null };

export function formFillSystem(input: { companyBlock: string; contactBlock: string; announcement: { title: string; organization: string | null; summary: string | null }; noticeText: string | null; now: Date }): string {
  return `너는 정부·지자체 지원사업의 신청 양식(참여의향서·신청서) 칸을 회사 정보로 채우는 보조다.

규칙 (가장 중요):
- 아래 <company>·<contact>와 공고에 있는 사실만 쓴다. 이름·전화·이메일·주소·숫자를 지어내지 않는다.
- 근거가 없는 text 칸은 value를 빈 문자열로 두고 needsCheck에 무엇이 필요한지 적는다. 값 칸에 "확인 필요" 같은 글자를 넣지 않는다 (그대로 문서에 들어간다).
- choice 칸은 options 중에서만 고른다. multi가 false면 하나만. 회사 정보로 분명하지 않으면 고르지 말고 needsCheck에 적는다.
  - 예: 기관유형은 회사가 기업이면 "기업". 관심 분야는 회사 아이템·주력 사업과 분명히 닿는 것만.
- 서술 칸(hint에 예시가 있는 칸)은 예시의 길이·말투를 따라 2~4문장으로, 회사 정보와 공고 내용만으로 쓴다. 예시 문장을 베끼지 않는다.
- 연락처 칸은 칸 이름에 맞는 값 하나만 (휴대전화 칸에 휴대전화만).
- 모든 값은 한국어. 오늘은 ${input.now.toISOString().slice(0, 10)}.

${input.companyBlock}

<contact>
${input.contactBlock}
</contact>

<announcement>
- 공고명: ${input.announcement.title}
${input.announcement.organization ? `- 기관: ${input.announcement.organization}\n` : ""}${input.announcement.summary ? `- 요약: ${input.announcement.summary.slice(0, 3000)}\n` : ""}</announcement>
${input.noticeText ? `\n<notice>\n${input.noticeText.slice(0, 20_000)}\n</notice>` : ""}`;
}

export function formFillUserMessage(title: string | null, fields: FillFieldInput[]): string {
  const list = fields
    .map((f) =>
      [
        `- id: ${f.id}`,
        `  칸: ${f.label}`,
        `  종류: ${f.kind}${f.kind === "choice" ? ` (${f.multi ? "여러 개 고를 수 있음" : "하나만"})` : ""}`,
        f.options.length ? `  options: ${f.options.join(" | ")}` : null,
        f.hint ? `  hint: ${f.hint.replace(/\n/g, " / ")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return `양식: ${title ?? "(제목 없음)"}\n\n채울 칸:\n${list}\n\n모든 칸에 대해 fields를 돌려줘.`;
}
