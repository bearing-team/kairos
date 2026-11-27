// 헬스체크 (로그인 없이). DB까지 닿는지만 본다. 비밀값·내부 정보는 내보내지 않는다
import { connection } from "next/server";
import { prisma } from "@/server/db";

export async function GET() {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
