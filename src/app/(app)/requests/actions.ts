"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { createRequest, updateRequest } from "@/server/requests";
import { isRequestKind } from "@/lib/requests";

export type RequestActionState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const SendSchema = z.object({
  toId: z.string().min(1, "받는 사람을 골라 주세요"),
  kind: z.string().refine(isRequestKind, "요청 종류를 골라 주세요"),
  sectionId: z.string().optional(),
  message: z.string().trim().min(1, "무엇을 부탁하는지 한 줄 남겨 주세요").max(2000, "2000자까지 쓸 수 있어요"),
  due: z.string().optional(),
});

export async function sendRequest(applicationId: string, _prev: RequestActionState, fd: FormData): Promise<RequestActionState> {
  const me = await requireUser();
  const parsed = SendSchema.safeParse({
    toId: fd.get("toId") ?? "",
    kind: fd.get("kind") ?? "",
    sectionId: fd.get("sectionId") || undefined,
    message: fd.get("message") ?? "",
    due: fd.get("due") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, message: "입력을 확인해 주세요", errors };
  }
  const d = parsed.data;
  const r = await createRequest(me, {
    applicationId,
    toId: d.toId,
    kind: d.kind as Parameters<typeof createRequest>[1]["kind"],
    sectionId: d.sectionId ?? null,
    message: d.message,
    due: d.due ?? null,
  });
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "요청을 보냈어요" };
}

export async function respondRequest(id: string, action: "done" | "declined" | "canceled" | "reopen", reply?: string): Promise<RequestActionState> {
  const me = await requireUser();
  const text = reply?.trim().slice(0, 1000) || null;
  const r = await updateRequest(me, id, action, text);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/", "layout");
  return { ok: true, message: { done: "완료로 표시했어요", declined: "거절했어요", canceled: "요청을 취소했어요", reopen: "다시 열었어요" }[action] };
}
