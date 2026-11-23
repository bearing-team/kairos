import { z } from "zod";

export const FORM_SECTIONS_PROMPT_VERSION = "form-sections.v1";

/** 양식·공고문 → 작성할 섹션, 평가 기준, 제출 서류. 개수 제한은 받은 뒤 코드에서 자른다 */
export const FormSectionsSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().describe("양식에 적힌 섹션 제목 그대로 (번호 빼고). 예: '문제 인식 (Problem)', '시장 현황 및 경쟁사 분석'"),
        guidance: z.string().describe("양식의 작성 요령·안내문 요약. 무엇을 쓰라고 하는지. 없으면 빈 문자열"),
        limitChars: z.number().int().nullable().describe("양식에 글자 수나 분량 제한이 적혀 있으면 글자 수(쪽 수면 1쪽=1500자로 환산). 없으면 null"),
      }),
    )
    .describe("회사가 서술형으로 써야 하는 섹션, 양식 순서대로. 최대 15개"),
  criteria: z.array(z.string()).describe("공고·양식에 적힌 평가(심사) 기준과 배점. 예: '사업화 전략 30점'. 없으면 빈 배열, 최대 10개"),
  requiredDocs: z
    .array(
      z.object({
        name: z.string().describe("제출 서류 이름. 예: '사업자등록증명원', '중소기업 확인서'"),
        required: z.boolean().describe("필수면 true, 해당자만·가점용이면 false"),
        note: z.string().describe("발급처·기준일·해당 조건 등 짧은 메모. 없으면 빈 문자열"),
      }),
    )
    .describe("신청할 때 내야 하는 서류 목록. 최대 20개"),
});
export type FormSections = z.infer<typeof FormSectionsSchema>;

export const FORM_SECTIONS_SYSTEM = `너는 정부지원사업 신청 양식을 읽고 작성할 항목을 정리하는 보조다.
사용자가 공고 정보, 신청 양식(사업계획서 등)에서 뽑은 글자, 공고문 글자를 준다. 표는 "[표] … [/표]" 사이에 "칸 | 칸" 줄로 들어 있다.

할 일:
1. sections: 회사가 문장으로 채워야 하는 서술형 섹션만 양식 순서대로 뽑는다.
   - 포함: 사업 개요, 문제 인식, 해결 방안, 시장·경쟁 분석, 사업화 전략, 추진 일정, 팀 구성, 기대 효과처럼 서술을 요구하는 항목
   - 제외: 기업명·사업자번호·주소 같은 기본 정보 칸, 재무 수치 표, 서명·동의서·확약서, 목차, 작성 예시 자체
   - 큰 장(Ⅰ, Ⅱ…) 아래 작은 항목(1., 2. …)이 서술 단위면 작은 항목을 섹션으로 한다. 너무 잘게(한 줄짜리 칸) 쪼개지 않는다
   - guidance는 양식 안의 안내문(※, ○, - 로 시작하는 작성 요령, "~를 기재" 등)을 1~3문장으로 요약한다
2. criteria: 평가(심사) 기준과 배점이 있으면 그대로 옮긴다
3. requiredDocs: 제출 서류 목록. 신청서 양식 자체(사업계획서, 신청서)도 서류로 포함한다

규칙:
- 주어진 글자에 있는 것만 옮긴다. 없는 섹션·기준·서류를 지어내지 않는다
- 양식에 서술형 섹션이 하나도 없으면 sections를 빈 배열로 둔다
- 모든 값은 한국어`;

const cap = (s: string | null, n: number) => (!s ? null : s.length > n ? `${s.slice(0, n)}\n…(이하 생략)` : s);

export function formSectionsUserMessage(input: {
  title: string;
  organization: string | null;
  summary: string | null;
  form: { fileName: string; text: string } | null;
  notice: { fileName: string; text: string } | null;
}): string {
  return `<announcement>
- 공고명: ${input.title}
${input.organization ? `- 기관: ${input.organization}\n` : ""}
## 본문 요약
${cap(input.summary, 4000) ?? "(없음)"}
</announcement>

<form file="${input.form?.fileName ?? ""}">
${cap(input.form?.text ?? null, 60_000) ?? "(양식 없음)"}
</form>

<notice file="${input.notice?.fileName ?? ""}">
${cap(input.notice?.text ?? null, 30_000) ?? "(공고문 없음)"}
</notice>

이 공고에 신청하려면 무엇을 써야 하고 어떤 서류가 필요한지 정리해 줘.`;
}
