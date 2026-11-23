// 낙관적 인증 체크 (쿠키의 JWT만 확인). 실제 권한 검증은 서버의 requireUser()에서 다시 한다
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// authConfig.callbacks.authorized가 리디렉션을 결정한다
export default auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
