"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { describeSend, sendDeadlineAlerts, sendDigest } from "@/server/notify/run";

export type NotifyState = { ok: boolean; message: string } | null;

/** 알림 탭의 "지금 보내기" (수동 발송) */
export async function sendNotificationNow(kind: "digest" | "deadline", _prev: NotifyState): Promise<NotifyState> {
  const user = await requireUser();
  const r = kind === "digest" ? await sendDigest({ manual: true, userId: user.id }) : await sendDeadlineAlerts({ manual: true, userId: user.id });
  revalidatePath("/company");
  return { ok: r.sent || r.reason === "nothing", message: describeSend(r) };
}
