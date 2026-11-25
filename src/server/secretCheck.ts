import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { checkWebhookUrl } from "@/server/notify/slack";
import { fetchBizinfo } from "@/server/sources/bizinfo";
import { fetchKstartup } from "@/server/sources/kstartup";
import type { SecretName } from "@/server/secrets";

/**
 * 저장하기 전에 키가 실제로 동작하는지 한 번 확인한다.
 * Slack은 확인하려면 채널에 메시지가 가므로 주소 형식만 본다 (실제 발송 확인은 Slack 알림 탭의 지금 보내기)
 */
export async function verifySecret(name: SecretName, value: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    switch (name) {
      case "ANTHROPIC_API_KEY":
        await new Anthropic({ apiKey: value, maxRetries: 0, timeout: 20_000 }).models.list({ limit: 1 });
        return { ok: true };
      case "SLACK_WEBHOOK_URL": {
        const r = checkWebhookUrl(value);
        return "url" in r ? { ok: true } : { ok: false, error: r.error };
      }
      case "BIZINFO_API_KEY":
        await fetchBizinfo(value, { count: 1 });
        return { ok: true };
      case "DATA_GO_KR_SERVICE_KEY":
        await fetchKstartup(value, { perPage: 1, maxPages: 1 });
        return { ok: true };
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "키가 올바르지 않아요 (Anthropic이 거절)" };
    if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, error: "이 키로는 쓸 수 없어요 (권한 없음)" };
    if (e instanceof Anthropic.APIConnectionError) return { ok: false, error: "Anthropic에 연결하지 못했어요. 잠시 뒤 다시 해 주세요" };
    if (e instanceof Anthropic.APIError) return { ok: false, error: `Anthropic 확인 중 오류 (${e.status})` };
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `키 확인에 실패했어요: ${msg.slice(0, 160)}` };
  }
}
