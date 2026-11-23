// 초안 프롬프트용 회사 정보 블록. 값이 없으면 "(프로필에 없음)"으로 적어 모델이 지어내지 않게 한다
import { formatYearsInBusiness, kstDateString } from "@/lib/kst";

export type BlockCompany = {
  name: string;
  industryLabel: string | null;
  region: string | null;
  bizType: "corporation" | "individual" | null;
  foundedAt: Date | null;
  headcount: number | null;
  revenueBand: string | null;
  certifications: string[];
  ksicCodes: string[];
  description: string | null;
};
export type BlockItemCard = { name: string; problem: string | null; solution: string | null; customer: string | null; differentiation: string | null; traction: string | null; links: string[] };

const BIZ = { corporation: "법인", individual: "개인사업자" } as const;
const NONE = "(프로필에 없음)";
const v = (x: string | number | null | undefined) => (x === null || x === undefined || x === "" ? NONE : String(x));

export function companyBlock(c: BlockCompany, cards: BlockItemCard[], focusCard: string | null, now: Date): string {
  const profile = [
    `- 회사명: ${c.name}`,
    `- 한 줄 소개: ${v(c.industryLabel)}`,
    `- 소재지: ${v(c.region)}`,
    `- 사업자 형태: ${c.bizType ? BIZ[c.bizType] : NONE}`,
    `- 설립일: ${c.foundedAt ? `${kstDateString(c.foundedAt)} (${formatYearsInBusiness(c.foundedAt, now)})` : NONE}`,
    `- 인원: ${c.headcount !== null ? `${c.headcount}명` : NONE}`,
    `- 매출 구간: ${v(c.revenueBand)}`,
    `- 보유 인증·특허: ${c.certifications.length ? c.certifications.join(", ") : NONE}`,
    `- 업종 코드(KSIC): ${c.ksicCodes.length ? c.ksicCodes.join(", ") : NONE}`,
    `- 주력 사업: ${v(c.description)}`,
  ].join("\n");
  const ordered = focusCard ? [...cards].sort((a, b) => Number(b.name === focusCard) - Number(a.name === focusCard)) : cards;
  const cardText = ordered.length
    ? ordered
        .map((k) =>
          [
            `### ${k.name}${k.name === focusCard ? " (이 공고에 쓸 아이템)" : ""}`,
            `- 문제: ${v(k.problem)}`,
            `- 해결: ${v(k.solution)}`,
            `- 고객: ${v(k.customer)}`,
            `- 차별점: ${v(k.differentiation)}`,
            `- 성과: ${v(k.traction)}`,
            k.links.length ? `- 링크: ${k.links.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n")
    : "(아이템 카드 없음)";
  return `<company>\n## 회사 프로필\n${profile}\n\n## 아이템 카드\n${cardText}\n</company>`;
}
