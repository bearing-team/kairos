// Slack Incoming Webhook (ARCHITECTURE.md 7절). 주소는 .env SLACK_WEBHOOK_URL 또는 화면에서 넣은 값
import { secret } from "@/server/secrets";

export type SlackResult = { ok: true } | { ok: false; error: string };

/** 웹훅 주소 검사: Slack 공식 주소만. 개발 중에는 로컬 테스트 서버도 허용 */
export function webhookUrl(): { url: string } | { error: string } {
  return checkWebhookUrl(secret("SLACK_WEBHOOK_URL"));
}

/** 주소 형식만 검사 (화면에서 저장하기 전에도 쓴다) */
export function checkWebhookUrl(input: string | null | undefined): { url: string } | { error: string } {
  const raw = input?.trim();
  if (!raw) return { error: "SLACK_WEBHOOK_URL이 없어요" };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { error: "SLACK_WEBHOOK_URL 형식이 올바르지 않아요" };
  }
  const slack = u.protocol === "https:" && u.hostname === "hooks.slack.com" && u.pathname.startsWith("/services/");
  const localTest = process.env.NODE_ENV !== "production" && u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
  if (!slack && !localTest) return { error: "SLACK_WEBHOOK_URL은 https://hooks.slack.com/services/… 주소여야 해요" };
  return { url: u.toString() };
}

export function slackConfigured() {
  return "url" in webhookUrl();
}

// Slack 오류 응답 → 사람이 읽는 문장 (https://api.slack.com/messaging/webhooks#handling_errors)
const SLACK_ERRORS: Record<string, string> = {
  invalid_token: "웹훅 주소가 올바르지 않거나 폐기됐어요",
  no_service: "웹훅이 비활성화됐거나 없어요",
  no_team: "Slack 워크스페이스를 찾지 못했어요",
  team_disabled: "Slack 워크스페이스가 비활성화됐어요",
  channel_not_found: "채널을 찾지 못했어요",
  channel_is_archived: "채널이 보관 처리됐어요",
  action_prohibited: "관리자가 이 웹훅을 막았어요",
  posting_to_general_channel_denied: "이 채널에는 보낼 권한이 없어요",
  invalid_payload: "메시지 형식이 올바르지 않아요",
  no_text: "메시지 내용이 비었어요",
};

export async function postSlack(text: string): Promise<SlackResult> {
  const w = webhookUrl();
  if ("error" in w) return { ok: false, error: w.error };
  try {
    const res = await fetch(w.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.text()).trim().slice(0, 100);
    return { ok: false, error: SLACK_ERRORS[body] ?? `Slack 응답 ${res.status}${body ? ` (${body})` : ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "Slack 응답이 10초 안에 오지 않았어요" : "Slack에 연결하지 못했어요" };
  }
}

/** mrkdwn 본문 이스케이프 (&, <, >) */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** <url|텍스트> 링크. 텍스트의 | 와 > 는 링크를 깨뜨리므로 바꾼다 */
export function link(url: string | null, text: string) {
  const t = esc(text).replace(/\|/g, "¦");
  if (!url || !/^https?:\/\//.test(url)) return t;
  return `<${url.replace(/[<>|\s]/g, encodeURIComponent)}|${t}>`;
}
