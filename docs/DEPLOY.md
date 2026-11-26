# 배포 (Railway)

설정은 `.railway/railway.ts` 한 파일이다 (Railway Infrastructure as Code, `railway` 패키지 3.18).
예전 방식인 `railway.json`/`railway.toml`은 2026-12-01부터 읽히지 않으니 만들지 않는다.

## 구성

| 리소스 | 하는 일 | 메모 |
| --- | --- | --- |
| `postgres` | DB | `DATABASE_URL`이 웹·워커에 참조로 들어감 (내부망) |
| `web` | Next.js 화면·API | `pnpm build` → `pnpm start`. 배포 전에 `pnpm db:deploy`(마이그레이션 + 회사가 없을 때만 시드). 헬스체크 `/api/health` |
| `worker` | pg-boss 일정 작업 | `pnpm worker`. 소싱·점수·Slack 알림. 도메인 없음 |
| `kairos-files` 볼륨 | 첨부·양식 파일 | 웹의 `/data`에 붙음, `STORAGE_DIR=/data/storage` |

- Node는 22 (`RAILPACK_NODE_VERSION`). 로컬은 20이어도 된다
- `TZ=Asia/Seoul`. 일정은 pg-boss가 KST로 따로 계산하지만 로그 시각을 맞추려고
- `PORT`는 Railway가 넣고 `next start`가 그대로 읽는다

## 처음 한 번

1. Railway에 GitHub `bearing-team/kairos` 저장소 접근을 허용한다 (Railway GitHub 앱)
2. 로컬에서 Railway CLI 로그인, 빈 프로젝트를 만들거나 고른다
   ```bash
   railway login
   railway link
   ```
3. **비밀값을 대시보드에서 먼저 넣는다.** 설정 파일에는 `preserve()`(있는 값 유지)로만 적혀 있다
   - 웹·워커 둘 다: `AUTH_SECRET` (`openssl rand -base64 32`. **한 번 정하면 바꾸지 않는다** — 화면에서 넣은 연결 키가 이 값으로 암호화됨)
   - 웹: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL_DOMAIN`
   - 서비스가 아직 없으면 4번을 먼저 하고 넣은 뒤 다시 배포한다
4. 계획을 보고 적용한다
   ```bash
   railway config plan
   ```
   ```bash
   railway config apply
   ```
5. 웹 서비스 Settings → Networking에서 **도메인 생성** (생성 도메인은 설정 파일로 못 만든다)
6. Google Cloud Console OAuth 클라이언트에 리디렉션 URI 추가: `https://<웹 도메인>/api/auth/callback/google`

## 넣지 않는 것

- `AUTH_DEV_LOGIN` — 개발용 로그인. production에서는 코드에서도 꺼진다
- `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`, `BIZINFO_API_KEY`, `DATA_GO_KR_SERVICE_KEY` — 앱의 회사 프로필 → "연결 키"에서 넣는다 (DB에 암호화, 웹·워커가 같이 읽음). 환경 변수로 넣어도 되고, 그러면 그쪽이 먼저
- `APP_BASE_URL` — 비우면 웹 도메인(`RAILWAY_PUBLIC_DOMAIN`, 워커는 `APP_PUBLIC_DOMAIN`)으로 Slack 링크를 만든다. 직접 도메인을 붙였으면 그 주소로 넣는다

## 이후

- `main`에 푸시하면 웹·워커가 같이 다시 배포된다. 마이그레이션은 웹 배포 전에 돈다
- 설정을 바꿀 때는 `.railway/railway.ts`를 고치고 `railway config plan` → `apply`. 대시보드에서 바꾼 값은 다음 apply 때 이 파일 기준으로 되돌아갈 수 있다 (비밀값 `preserve()`는 그대로)
- 로그: `railway logs --service worker`
