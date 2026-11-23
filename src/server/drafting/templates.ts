// 양식을 못 읽었을 때 쓰는 기본 섹션 (PRD F4.2: 창업패키지형 / 바우처형 / R&D형)
export type TemplateSection = { key: string; title: string; guidance: string; limitChars: number | null };
export type TemplateType = "startup" | "voucher" | "rnd";

export const TEMPLATE_LABEL: Record<TemplateType, string> = { startup: "창업패키지형", voucher: "바우처형", rnd: "R&D형" };

export const TEMPLATES: Record<TemplateType, TemplateSection[]> = {
  // 창업진흥원 PSST 구성
  startup: [
    { key: "summary", title: "사업 개요", guidance: "아이템 이름, 한 줄 소개, 목표 고객, 지원 기간 동안의 목표를 요약", limitChars: 800 },
    { key: "problem", title: "문제 인식 (Problem)", guidance: "아이템을 만든 배경과 고객이 겪는 문제, 기존 방식의 한계, 개발 필요성", limitChars: 1500 },
    { key: "solution", title: "실현 가능성 (Solution)", guidance: "제품·서비스 내용, 현재 개발 단계, 지원 기간 개발 계획, 경쟁 제품 대비 차별점", limitChars: 1500 },
    { key: "scaleup", title: "성장 전략 (Scale-up)", guidance: "목표 시장과 진입 전략, 수익 모델, 사업화 일정, 자금 조달 계획", limitChars: 1500 },
    { key: "team", title: "팀 구성 (Team)", guidance: "대표자와 팀원의 역량, 추가 채용 계획, 협력 기관", limitChars: 1200 },
  ],
  voucher: [
    { key: "overview", title: "기업 현황", guidance: "회사 소개, 주력 제품·서비스, 주요 고객", limitChars: 1000 },
    { key: "need", title: "지원 필요성", guidance: "바우처로 해결하려는 과제와 현재 상황, 왜 지금 필요한지", limitChars: 1200 },
    { key: "plan", title: "활용 계획", guidance: "이용할 서비스(수행기관)와 항목별 내용, 일정, 예산 배분", limitChars: 1500 },
    { key: "effect", title: "기대 효과", guidance: "지원 후 달라지는 점과 측정할 지표(매출, 고객, 효율 등)", limitChars: 1000 },
  ],
  rnd: [
    { key: "overview", title: "기술개발 개요", guidance: "개발하려는 기술·제품, 최종 목표", limitChars: 1000 },
    { key: "necessity", title: "기술개발 필요성", guidance: "기술·시장 측면의 필요성, 기존 기술의 한계", limitChars: 1500 },
    { key: "status", title: "국내외 기술 현황", guidance: "경쟁 기술·제품 비교, 우리 기술의 위치", limitChars: 1500 },
    { key: "content", title: "개발 내용 및 방법", guidance: "세부 개발 내용, 연차별 목표, 개발 방법과 일정", limitChars: 2000 },
    { key: "commercial", title: "사업화 계획", guidance: "목표 시장, 판로, 매출 계획, 투자 계획", limitChars: 1500 },
    { key: "capability", title: "수행 역량", guidance: "연구 인력, 보유 기술·특허, 장비·시설", limitChars: 1200 },
  ],
};

/** 공고명·분야로 고른다. 모르겠으면 창업패키지형 */
export function pickTemplate(a: { title: string; category: string | null }): TemplateType {
  const s = `${a.title} ${a.category ?? ""}`;
  if (/바우처/.test(s)) return "voucher";
  if (/R&D|R＆D|연구개발|기술개발|과제/.test(s)) return "rnd";
  return "startup";
}
