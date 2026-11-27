import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/server/db";
import { ensureSecrets } from "@/server/secrets";

export type CurrentUser = { id: string; name: string | null; email: string | null; companyId: string };

// 이메일·비밀번호 로그인. 쿠키에는 무작위 토큰, DB(Session.id)에는 그 sha256만 둔다
export const SESSION_COOKIE = "kairos_session";
const SESSION_DAYS = 30;
const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

/** 로그인 성공 시: 세션을 만들고 쿠키를 심는다 (서버 액션 안에서만) */
export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: tokenId(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  // 오래된 세션 정리 (가볍게, 실패해도 무시)
  prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: tokenId(token) } });
  jar.delete(SESSION_COOKIE);
}

/** 지금 로그인한 사용자 (없으면 null). 한 요청 안에서는 한 번만 읽는다 */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { id: tokenId(token) },
    select: { expiresAt: true, user: { select: { id: true, name: true, email: true, companyId: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.companyId) return null;
  return { ...s.user, companyId: s.user.companyId };
});

/** 데이터 접근 전 반드시 호출. 로그인하지 않았으면 /login으로 보낸다 */
export async function requireUser(): Promise<CurrentUser> {
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login");
  // 화면에서 넣은 연결 키를 읽어 둔다 (1분 캐시). 뒤이은 after() 작업도 같은 값을 쓴다
  await ensureSecrets();
  return user;
}
