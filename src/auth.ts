import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Provider } from "next-auth/providers";
import { prisma } from "@/server/db";
import { authConfig } from "./auth.config";

const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase();

/** 팀 도메인 이메일만 통과. 도메인이 설정 안 됐으면 아무도 못 들어온다 (실수로 열리는 것 방지) */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email || !allowedDomain) return false;
  return email.toLowerCase().endsWith(`@${allowedDomain}`);
}

export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

export const googleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: Provider[] = [];

if (googleConfigured) {
  providers.push(
    Google({
      // hd: 구글 계정 선택 화면에서 팀 도메인을 우선 보여준다 (검증은 signIn 콜백에서)
      authorization: { params: allowedDomain ? { hd: allowedDomain, prompt: "select_account" } : {} },
    }),
  );
}

if (devLoginEnabled) {
  // 개발 전용: 구글 키 없이 화면을 확인하기 위한 로그인. production 빌드에서는 등록되지 않는다
  providers.push(
    Credentials({
      id: "dev",
      name: "개발용 로그인",
      credentials: {},
      async authorize() {
        const email = `dev@${allowedDomain ?? "localhost"}`;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: "개발자" },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile, user }) {
      if (account?.provider === "dev") return devLoginEnabled;
      if (account?.provider === "google") {
        return profile?.email_verified === true && isAllowedEmail(profile.email);
      }
      return isAllowedEmail(user.email);
    },
  },
});
