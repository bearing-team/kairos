// proxy에서도 쓰는 가벼운 설정 (DB 접근 없음). 프로바이더·어댑터는 auth.ts에서 붙인다.
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // proxy의 낙관적 체크: 로그인 안 했으면 /login으로
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage) {
        return isLoggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
