import "server-only";
import { secretStatuses, type SecretName, type SecretStatus } from "@/server/secrets";
import type { KeyView } from "@/components/settings/KeyButton";

/** 연결 키 표시 정보 (어디에 쓰는지·어디서 받는지) */
export const KEY_INFO: Record<SecretName, { label: string; use: string; where: string; whereUrl: string; placeholder: string }> = {
  ANTHROPIC_API_KEY: {
    label: "Anthropic API 키",
    use: "공고 점수, 게시판 읽기, 주소로 추가, 초안 작성",
    where: "console.anthropic.com",
    whereUrl: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-…",
  },
  SLACK_WEBHOOK_URL: {
    label: "Slack 웹훅 주소",
    use: "주간 다이제스트, 마감 알림, 리뷰 요청",
    where: "Slack 앱 설정 › Incoming Webhooks",
    whereUrl: "https://api.slack.com/messaging/webhooks",
    placeholder: "https://hooks.slack.com/services/…",
  },
  BIZINFO_API_KEY: {
    label: "기업마당 API 키",
    use: "기업마당 공고 매일 가져오기",
    where: "bizinfo.go.kr API 신청",
    whereUrl: "https://www.bizinfo.go.kr/apiDetail.do?id=bizinfoApi",
    placeholder: "인증키",
  },
  DATA_GO_KR_SERVICE_KEY: {
    label: "공공데이터포털 서비스 키",
    use: "K-Startup 공고 매일 가져오기",
    where: "data.go.kr K-Startup API 활용 신청",
    whereUrl: "https://www.data.go.kr/data/15125364/openapi.do",
    placeholder: "일반 인증키 (Encoding·Decoding 둘 다 돼요)",
  },
};

export function keyView(s: SecretStatus): KeyView {
  return { name: s.name, label: KEY_INFO[s.name].label, source: s.source, last4: s.last4, broken: s.broken, placeholder: KEY_INFO[s.name].placeholder };
}

export async function keyViews() {
  const st = await secretStatuses();
  return { statuses: st, views: Object.fromEntries(Object.entries(st).map(([k, v]) => [k, keyView(v)])) as Record<SecretName, KeyView> };
}
