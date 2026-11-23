// 회사 프로필 선택지
export const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;

export const BIZ_TYPE_LABEL = { corporation: "법인", individual: "개인" } as const;

export const EXCLUSION_KIND_LABEL = {
  keyword: { label: "키워드", help: "공고명·요약에 이 단어가 있으면 제외 (예: 제조)" },
  region: { label: "지역 한정", help: "이 지역 한정 공고 제외 (예: 서울)" },
  target: { label: "대상", help: "이 대상 전용 공고 제외 (예: 예비창업자)" },
  industry: { label: "업종", help: "이 업종 전용 공고 제외 (예: 농식품)" },
} as const;
