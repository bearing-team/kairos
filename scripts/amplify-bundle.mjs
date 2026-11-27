// Amplify Hosting 배포 묶음 만들기: `NEXT_OUTPUT=standalone next build` 결과 → .amplify-hosting/
// Amplify의 Next.js 자동 지원은 15까지라, Next 16은 "배포 명세(deploy-manifest)"로 일반 Node 서버로 올린다
// https://docs.aws.amazon.com/amplify/latest/userguide/ssr-deployment-specification.html
//  - compute/default: standalone 서버 (node entry.js, 포트 3000)
//  - static/_next/static: 빌드된 정적 파일 (CDN)
// Amplify 콘솔의 환경 변수는 SSR 런타임에 전달되지 않는다 → 아래 RUNTIME_ENV만 골라 server-env.json으로 같이 묶는다
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RUNTIME_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "BACKGROUND_JOBS",
  "STORAGE_DRIVER",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "APP_BASE_URL",
  // 화면의 "연결 키"로 넣어도 된다 (DB에 암호화). 환경 변수로 넣으면 이쪽이 먼저
  "ANTHROPIC_API_KEY",
  "SLACK_WEBHOOK_URL",
  "BIZINFO_API_KEY",
  "DATA_GO_KR_SERVICE_KEY",
  "LLM_MODEL_EXTRACT",
  "LLM_MODEL_SCORE",
  "LLM_MODEL_DRAFT",
  "SCORE_MAX_PER_RUN",
  "BOARD_MAX_PER_RUN",
];
const REQUIRED = ["DATABASE_URL", "AUTH_SECRET"];

const OUT = ".amplify-hosting";
const standalone = ".next/standalone";
if (!existsSync(join(standalone, "server.js"))) {
  console.error("`.next/standalone/server.js`가 없어요. NEXT_OUTPUT=standalone으로 빌드했는지 확인해 주세요");
  process.exit(1);
}
const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length && !process.argv.includes("--allow-missing-env")) {
  console.error(`Amplify 환경 변수가 비어 있어요: ${missing.join(", ")}`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
const compute = join(OUT, "compute/default");
const staticDir = join(OUT, "static");
mkdirSync(compute, { recursive: true });
mkdirSync(staticDir, { recursive: true });

// 심볼릭 링크는 따라가서 실제 파일로 (Amplify가 링크를 그대로 올리지 못할 수 있음)
// 트레이싱 제외로 대상이 빠진 링크(깨진 링크)는 건너뛴다
cpSync(standalone, compute, { recursive: true, dereference: true, filter: (src) => existsSync(src) });
// next build가 standalone에 .env*를 복사한다. 런타임 값은 server-env.json만 쓴다 (로컬에서 묶어도 로컬 비밀값이 섞이지 않게)
for (const f of readdirSync(compute)) if (f.startsWith(".env")) rmSync(join(compute, f));
cpSync(".next/static", join(staticDir, "_next/static"), { recursive: true });
if (existsSync("public")) cpSync("public", staticDir, { recursive: true });

const env = Object.fromEntries(RUNTIME_ENV.filter((k) => process.env[k]?.trim()).map((k) => [k, process.env[k]]));
writeFileSync(join(compute, "server-env.json"), JSON.stringify(env));
writeFileSync(
  join(compute, "entry.js"),
  `// Amplify 컴퓨트 진입점 (scripts/amplify-bundle.mjs가 만든다)
const env = require("./server-env.json");
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
process.env.NODE_ENV = "production";
process.env.PORT = "3000";
process.env.HOSTNAME = "0.0.0.0";
require("./server.js");
`,
);

const nextVersion = JSON.parse(readFileSync("node_modules/next/package.json", "utf8")).version;
const routes = [
  { path: "/_next/static/*", target: { kind: "Static", cacheControl: "public, max-age=31536000, immutable" } },
  ...(existsSync("public") ? [{ path: "/*.*", target: { kind: "Static" }, fallback: { kind: "Compute", src: "default" } }] : []),
  { path: "/*", target: { kind: "Compute", src: "default" } },
];
const manifest = {
  version: 1,
  framework: { name: "nextjs", version: nextVersion },
  routes,
  computeResources: [{ name: "default", runtime: "nodejs22.x", entrypoint: "entry.js" }],
};
writeFileSync(join(OUT, "deploy-manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Amplify 묶음 완료: ${OUT} (Next ${nextVersion}, 런타임 환경 변수 ${Object.keys(env).join(", ") || "없음"})`);
