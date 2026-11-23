"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/session";
import { getCompany } from "@/server/company";
import { REGIONS } from "@/lib/company";

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> } | null;

const optText = z
  .string()
  .trim()
  .transform((v) => (v ? v : null));
const list = z
  .string()
  .trim()
  .transform((v) => [...new Set(v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))]);
const optInt = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: msg });
        return z.NEVER;
      }
      return n;
    });

function toErrors(e: z.ZodError) {
  return Object.fromEntries(e.issues.map((i) => [String(i.path[0]), i.message]));
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

// ── 기본 정보 ─────────────────────────────

const companySchema = z.object({
  name: z.string().trim().min(1, "법인명을 입력해 주세요"),
  industryLabel: optText,
  foundedAt: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) {
        ctx.addIssue({ code: "custom", message: "날짜 형식이 맞지 않아요" });
        return z.NEVER;
      }
      return new Date(`${v}T00:00:00+09:00`); // KST 자정
    }),
  region: z.union([z.enum(REGIONS), z.literal("")]).transform((v) => v || null),
  bizType: z.union([z.enum(["corporation", "individual"]), z.literal("")]).transform((v) => v || null),
  ksicCodes: list,
  certifications: list,
  headcount: optInt(0, 100000, "인원은 0 이상 정수로 입력해 주세요"),
  revenueBand: optText,
  ceoBirthYear: optInt(1900, new Date().getFullYear(), "출생 연도를 4자리로 입력해 주세요"),
  description: optText,
});

export async function saveCompany(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = companySchema.safeParse(Object.fromEntries([...Object.keys(companySchema.shape)].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return { ok: false, message: "입력값을 확인해 주세요", errors: toErrors(parsed.error) };
  const company = await getCompany();
  await prisma.company.update({ where: { id: company.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: true, message: "저장했어요" };
}

// ── 아이템 카드 ───────────────────────────

const itemSchema = z.object({
  name: z.string().trim().min(1, "아이템 이름을 입력해 주세요"),
  problem: optText,
  solution: optText,
  customer: optText,
  differentiation: optText,
  traction: optText,
  links: list.pipe(z.array(z.url("링크는 http로 시작하는 주소로 입력해 주세요"))),
});

export async function saveItemCard(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = itemSchema.safeParse(Object.fromEntries([...Object.keys(itemSchema.shape)].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return { ok: false, message: "입력값을 확인해 주세요", errors: toErrors(parsed.error) };
  const company = await getCompany();
  if (id) {
    await prisma.itemCard.update({ where: { id, companyId: company.id }, data: parsed.data });
  } else {
    await prisma.itemCard.create({ data: { ...parsed.data, companyId: company.id } });
  }
  revalidatePath("/company");
  redirect("/company?tab=items");
}

export async function deleteItemCard(id: string) {
  await requireUser();
  const company = await getCompany();
  await prisma.itemCard.delete({ where: { id, companyId: company.id } });
  revalidatePath("/company");
  redirect("/company?tab=items");
}

// ── 제외 규칙 ─────────────────────────────

const ruleSchema = z.object({
  kind: z.enum(["keyword", "region", "target", "industry"], { message: "종류를 골라 주세요" }),
  value: z.string().trim().min(1, "값을 입력해 주세요").max(100),
  note: optText,
});

export async function addExclusionRule(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = ruleSchema.safeParse({ kind: str(fd, "kind"), value: str(fd, "value"), note: str(fd, "note") });
  if (!parsed.success) return { ok: false, message: "입력값을 확인해 주세요", errors: toErrors(parsed.error) };
  const company = await getCompany();
  await prisma.exclusionRule.create({ data: { ...parsed.data, companyId: company.id } });
  revalidatePath("/company");
  return { ok: true, message: "규칙을 추가했어요" };
}

export async function deleteExclusionRule(id: string) {
  await requireUser();
  const company = await getCompany();
  await prisma.exclusionRule.delete({ where: { id, companyId: company.id } });
  revalidatePath("/company");
}
