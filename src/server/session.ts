import "server-only";
import { connection } from "next/server";
import { prisma } from "@/server/db";
import { ensureSecrets } from "@/server/secrets";

export type CurrentUser = { id: string; name: string | null; email: string | null };

// 로그인 없이 쓰는 내부 툴: 모든 요청을 공용 팀 계정 하나로 처리한다 (상태 변경·코멘트 기록용)
const TEAM_EMAIL = "team@kairos.local";
const TEAM_NAME = "베어링 팀";
let teamUser: Promise<CurrentUser> | null = null;

function loadTeamUser(): Promise<CurrentUser> {
  teamUser ??= prisma.user
    .upsert({ where: { email: TEAM_EMAIL }, update: {}, create: { email: TEAM_EMAIL, name: TEAM_NAME } })
    .then((u) => ({ id: u.id, name: u.name, email: u.email }))
    .catch((e) => {
      teamUser = null;
      throw e;
    });
  return teamUser;
}

/** 데이터 접근 전 반드시 호출. 요청 시점에 공용 팀 계정을 돌려준다 */
export async function requireUser(): Promise<CurrentUser> {
  await connection();
  // 화면에서 넣은 연결 키를 읽어 둔다 (1분 캐시). 뒤이은 after() 작업도 같은 값을 쓴다
  await ensureSecrets();
  return loadTeamUser();
}
