"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";

export type MemberState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const Schema = z.object({
  name: z.string().trim().min(1, "이름을 넣어 주세요").max(40, "이름은 40자까지예요"),
  slackUserId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || /^[UW][A-Z0-9]{2,20}$/.test(v), "Slack 멤버 ID는 U로 시작해요 (프로필 → ⋮ → 멤버 ID 복사)"),
});

/** 내 이름·Slack 멤버 ID (구성원 탭의 내 줄) */
export async function saveMyProfile(_prev: MemberState, fd: FormData): Promise<MemberState> {
  const me = await requireUser();
  const parsed = Schema.safeParse({ name: fd.get("name") ?? "", slackUserId: fd.get("slackUserId") ?? "" });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, message: "입력을 확인해 주세요", errors };
  }
  await prisma.user.update({ where: { id: me.id }, data: { name: parsed.data.name, slackUserId: parsed.data.slackUserId || null } });
  revalidatePath("/", "layout");
  return { ok: true, message: "저장했어요" };
}
