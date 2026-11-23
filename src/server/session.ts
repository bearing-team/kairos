import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type CurrentUser = { id: string; name: string | null; email: string | null };

/** 데이터 접근 전 반드시 호출. 세션이 없으면 /login으로 보낸다 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");
  return { id: user.id, name: user.name ?? null, email: user.email ?? null };
}
