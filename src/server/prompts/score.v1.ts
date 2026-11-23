import { z } from "zod";
import { formatYearsInBusiness, kstDateString, kstYmd } from "@/lib/kst";

export const SCORE_PROMPT_VERSION = "score.v1";

/** LLM 점수 출력 (ARCHITECTURE.md 5.2). 개수·범위는 받은 뒤 코드에서 한 번 더 자른다 */
export const ScoreSchema = z.object({
  score: z.number().int().min(0).max(100).describe("적합도 0~100"),
  reasons: z.array(z.string()).describe("우리 회사에 맞는 이유, 최대 3개, 각 20자 안팎 명사구"),
  risks: z.array(z.string()).describe("지원 전에 확인해야 할 요건·불확실한 점, 최대 4개, 각 40자 이내"),
  suggestedItemCard: z.string().nullable().describe("이 공고에 쓸 아이템 카드 이름(목록의 이름 그대로). 맞는 카드가 없으면 null"),
  eligibility: z.enum(["eligible", "uncertain", "ineligible"]).describe("지원 자격: 충족 / 불확실 / 미달"),
});
export type ScoreOutput = z.infer<typeof ScoreSchema>;

export type ScoreCompany = {
  name: string;
  industryLabel: string | null;
  region: string | null;
  bizType: "corporation" | "individual" | null;
  foundedAt: Date | null;
  headcount: number | null;
  revenueBand: string | null;
  ceoBirthYear: number | null;
  certifications: string[];
  ksicCodes: string[];
  description: string | null;
};
export type ScoreItemCard = { name: string; problem: string | null; solution: string | null; customer: string | null; differentiation: string | null; traction: string | null };
export type ScoreHistory = { title: string; status: string; resultNote: string | null };
export type ScoreAnnouncement = {
  title: string;
  organization: string | null;
  executingOrg: string | null;
  target: string | null;
  regionLimit: string | null;
  applyPeriodText: string | null;
  supportAmountText: string | null;
  category: string | null;
  hashtags: string[];
  summary: string | null;
};

const RULES = `너는 베어링(주) 팀이 정부·지자체 지원사업 공고를 고를 때 돕는 심사 보조다.
아래 <company>(회사 프로필·아이템 카드·지원 이력)를 기준으로, 사용자가 주는 공고 하나가 이 회사에 얼마나 맞는지 평가한다.

점수 기준:
- 90~100: 지원 자격을 분명히 충족하고, 사업 목적·분야가 주력 아이템과 직접 맞으며, 지원 내용이 지금 단계에 실질적으로 도움 된다
- 70~89: 자격 충족 가능성이 높고 분야가 대체로 맞는다
- 40~69: 자격은 될 수 있지만 사업과의 연관이 약하거나, 자격 요건이 불확실하다
- 0~39: 자격 미달 가능성이 크거나 사업과 거의 무관하다

규칙:
- 공고와 회사 프로필에 실제로 적힌 내용만 근거로 쓴다. 회사에 대해 프로필에 없는 사실(매출, 실적, 인증, 고객사 등)을 가정하지 않는다.
- 요건 판단에 필요한 정보가 프로필에 없으면 risks에 "프로필에 ○○ 정보 없음"처럼 적고 eligibility는 uncertain으로 한다.
- reasons는 공고 요건과 회사 정보가 실제로 맞닿는 점만, 짧은 명사구로 쓴다 (예: "업력 3년 이내", "SW·플랫폼 분야", "부산 소재 기업 대상"). 맞는 점이 없으면 빈 배열.
- risks는 지원 전에 사람이 확인해야 할 요건이다 (예: "매출 실적 요건 확인 필요", "공동 신청 필수 여부"). 없으면 빈 배열.
- 자격을 명백히 충족하지 못하면 eligibility를 ineligible로 하고 점수를 39 이하로 준다.
- suggestedItemCard는 아이템 카드 목록에 있는 이름 그대로만 쓴다.
- 과장하지 않는다. 모든 문장은 한국어로 짧게.`;

const BIZ = { corporation: "법인", individual: "개인사업자" } as const;
const line = (label: string, v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : `- ${label}: ${v}`);

/** 시스템 프롬프트 = 규칙 + 회사 정보. 한 번의 점수 매기기 실행 동안 같으니 캐시한다 */
export function scoreSystem(c: ScoreCompany, cards: ScoreItemCard[], history: ScoreHistory[], now: Date): string {
  const nowYear = kstYmd(now).year;
  const profile = [
    line("회사명", c.name),
    line("한 줄 소개", c.industryLabel),
    line("소재지", c.region),
    line("사업자 형태", c.bizType ? BIZ[c.bizType] : null),
    c.foundedAt
      ? `- 설립일: ${kstDateString(c.foundedAt)} (${formatYearsInBusiness(c.foundedAt, now)})`
      : "- 설립일: (프로필에 없음)",
    line("인원", c.headcount !== null ? `${c.headcount}명` : null),
    line("매출 구간", c.revenueBand),
    line("대표자 출생연도", c.ceoBirthYear ? `${c.ceoBirthYear} (만 ${nowYear - c.ceoBirthYear - 1}~${nowYear - c.ceoBirthYear}세)` : null),
    line("보유 인증·특허", c.certifications.join(", ")),
    line("업종 코드(KSIC)", c.ksicCodes.join(", ")),
    line("주력 사업", c.description),
  ]
    .filter(Boolean)
    .join("\n");

  const cardText = cards.length
    ? cards
        .map((k) =>
          [`### ${k.name}`, line("문제", k.problem), line("해결", k.solution), line("고객", k.customer), line("차별점", k.differentiation), line("성과", k.traction)]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")
    : "(아이템 카드 없음)";

  const historyText = history.length ? history.map((h) => `- ${h.title}: ${h.status}${h.resultNote ? ` (${h.resultNote})` : ""}`).join("\n") : "(지원 이력 없음)";

  return `${RULES}

<company>
## 회사 프로필
${profile}

## 아이템 카드
${cardText}

## 최근 지원 이력
${historyText}
</company>`;
}

export function scoreUserMessage(a: ScoreAnnouncement, filterNotes: string[], now: Date): string {
  const SUMMARY_LIMIT = 4000;
  const summary = a.summary && a.summary.length > SUMMARY_LIMIT ? `${a.summary.slice(0, SUMMARY_LIMIT)}…(이하 생략)` : a.summary;
  return `오늘(KST): ${kstDateString(now)}

<announcement>
${[
  line("공고명", a.title),
  line("주관 기관", a.organization),
  line("수행 기관", a.executingOrg !== a.organization ? a.executingOrg : null),
  line("지원 대상", a.target),
  line("지역 제한", a.regionLimit),
  line("접수 기간", a.applyPeriodText),
  line("지원 규모", a.supportAmountText),
  line("분야", a.category),
  line("해시태그", a.hashtags.join(", ")),
]
  .filter(Boolean)
  .join("\n")}

## 본문 요약
${summary ?? "(본문 없음)"}
</announcement>
${filterNotes.length ? `\n규칙 검사에서 확인하지 못한 점:\n${filterNotes.map((n) => `- ${n}`).join("\n")}\n` : ""}
이 공고가 위 회사에 얼마나 맞는지 평가해 줘.`;
}
