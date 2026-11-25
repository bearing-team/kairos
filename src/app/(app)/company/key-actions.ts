"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { isSecretName, removeSecret, secretStatuses, storeSecret } from "@/server/secrets";
import { verifySecret } from "@/server/secretCheck";

export type KeyState = { ok: boolean; message: string } | null;

/** 키 저장: 실제로 한 번 확인 → 암호화해 DB에. .env에 있는 키는 화면에서 바꾸지 않는다 */
export async function saveKey(_prev: KeyState, fd: FormData): Promise<KeyState> {
  const user = await requireUser();
  const name = String(fd.get("name") ?? "");
  const value = String(fd.get("value") ?? "").trim();
  if (!isSecretName(name)) return { ok: false, message: "알 수 없는 키예요" };
  if (!value) return { ok: false, message: "키를 넣어 주세요" };
  if (value.length > 500 || /\s/.test(value)) return { ok: false, message: "공백 없이 키만 넣어 주세요" };
  if ((await secretStatuses())[name].source === "env") return { ok: false, message: ".env에 있는 키라 여기서 바꿀 수 없어요. .env를 고쳐 주세요" };

  const check = await verifySecret(name, value);
  if (!check.ok) return { ok: false, message: check.error };
  await storeSecret(name, value, user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: name === "SLACK_WEBHOOK_URL" ? "저장했어요. Slack 알림 탭에서 지금 보내기로 확인해 보세요" : "확인하고 저장했어요" };
}

export async function deleteKey(name: string): Promise<KeyState> {
  await requireUser();
  if (!isSecretName(name)) return { ok: false, message: "알 수 없는 키예요" };
  await removeSecret(name);
  revalidatePath("/", "layout");
  return { ok: true, message: "지웠어요" };
}
