import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureSecrets } from "@/server/secrets";

export type CurrentUser = { id: string; name: string | null; email: string | null };

/** 데이터 접근 전 반드시 호출. 세션이 없으면 /login으로 보낸다 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) redirect("/login");
  // 화면에서 넣은 연결 키를 읽어 둔다 (1분 캐시). 뒤이은 after() 작업도 같은 값을 쓴다
  await ensureSecrets();
  return { id: user.id, name: user.name ?? null, email: user.email ?? null };
}
