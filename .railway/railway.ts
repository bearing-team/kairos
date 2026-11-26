// Railway 배포 설정 (Infrastructure as Code). 적용: `railway config plan` → `railway config apply`
// 자세한 순서는 docs/DEPLOY.md. 비밀값은 여기 적지 않는다 (공개 저장소) — 대시보드에서 넣고 preserve()로 유지
import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

const REPO = "bearing-team/kairos";

export default defineRailway(() => {
  const db = postgres("postgres");
  // 공고 첨부·양식 파일 (STORAGE_DIR). 초안 작업은 웹 프로세스(after)에서 돌아서 웹에만 붙인다
  const files = volume("kairos-files");

  // 두 서비스가 같이 쓰는 값
  const common = {
    DATABASE_URL: db.env.DATABASE_URL,
    // pnpm 패키지 중 Railway SDK(개발용)가 Node 22를 요구해서 22로 맞춘다. 앱은 20·22 둘 다 돈다
    RAILPACK_NODE_VERSION: "22",
    TZ: "Asia/Seoul",
    // 비밀값: 대시보드 Variables에서 먼저 넣어 둔다 (docs/DEPLOY.md)
    AUTH_SECRET: preserve(),
  };

  const web = service("web", {
    source: github(REPO, { branch: "main" }),
    build: "pnpm build",
    start: "pnpm start",
    // 마이그레이션 후 회사 1개 만들기 (이미 있으면 건너뜀)
    preDeploy: "pnpm db:deploy",
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 10 },
    volumeMounts: { "/data": files },
    env: {
      ...common,
      STORAGE_DIR: "/data/storage",
      // Railway 프록시 뒤에서 Auth.js가 요청 호스트를 믿도록
      AUTH_TRUST_HOST: "true",
      AUTH_GOOGLE_ID: preserve(),
      AUTH_GOOGLE_SECRET: preserve(),
      ALLOWED_EMAIL_DOMAIN: preserve(),
    },
  });

  const worker = service("worker", {
    source: github(REPO, { branch: "main" }),
    // 워커는 Next 빌드가 필요 없다 (설치 때 postinstall로 Prisma 클라이언트도 만들어짐)
    build: "pnpm prisma generate",
    start: "pnpm worker",
    deploy: { restartPolicyType: "ALWAYS" },
    env: {
      ...common,
      // Slack 메시지 속 링크용 (웹 서비스 공개 주소)
      APP_PUBLIC_DOMAIN: web.env.RAILWAY_PUBLIC_DOMAIN,
    },
  });

  return project("kairos", { resources: [db, files, web, worker] });
});
