"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { endSession, startSession } from "@/server/session";
import { hashPassword, normalizeCompanyName, verifyPassword } from "@/server/auth/password";

export type AuthState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;

const email = z.string().trim().toLowerCase().email("이메일 형식이 아니에요").max(200);
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

const LoginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 넣어 주세요").max(200),
});

export async function login(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = LoginSchema.safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, companyId: true },
  });
  // 없는 계정도 같은 시간이 걸리게 해시를 한 번 돌린다
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { ok: false, message: "이메일이나 비밀번호가 맞지 않아요" };
  if (!user.companyId)
    return {
      ok: false,
      message: "소속 회사가 없는 계정이에요. 회원가입에서 같은 이메일로 소속 회사를 다시 넣어 주세요",
    };
  await startSession(user.id);
  redirect(safeNext(fd.get("next")));
}

const SignupSchema = z.object({
  name: z.string().trim().min(1, "이름을 넣어 주세요").max(40, "이름은 40자까지예요"),
  email,
  password: z.string().min(8, "비밀번호는 8자 이상이에요").max(200),
  company: z.string().trim().min(1, "소속 회사를 넣어 주세요").max(100),
});

/**
 * 회원가입: 소속 회사는 Kairos에 등록된 회사 이름과 맞아야 한다 ((주)·주식회사·띄어쓰기는 무시).
 * 회사를 새로 만들지는 않는다 (회사 데이터는 하나의 회사 기준으로 돌아간다)
 * 예전 계정(비밀번호 없음)과 같은 이메일이면 그 계정을 이어받는다 → 남긴 코멘트·기록이 그대로 이어진다
 */
export async function signup(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = SignupSchema.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
    password: fd.get("password"),
    company: fd.get("company"),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { name, password } = parsed.data;

  const wanted = normalizeCompanyName(parsed.data.company);
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });
  const company = wanted ? companies.find((c) => normalizeCompanyName(c.name) === wanted) : undefined;
  if (!company)
    return {
      ok: false,
      errors: {
        company: "Kairos에 등록된 회사가 아니에요. 회사 이름을 다시 확인해 주세요",
      },
    };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });
  if (existing?.passwordHash)
    return {
      ok: false,
      errors: { email: "이미 가입한 이메일이에요. 로그인해 주세요" },
    };

  const passwordHash = await hashPassword(password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name, passwordHash, companyId: company.id },
        select: { id: true },
      })
    : await prisma.user.create({
        data: {
          email: parsed.data.email,
          name,
          passwordHash,
          companyId: company.id,
        },
        select: { id: true },
      });
  await startSession(user.id);
  redirect(safeNext(fd.get("next")));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

const DUMMY_HASH = "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const k = String(issue.path[0] ?? "form");
    out[k] ??= issue.message;
  }
  return out;
}
