# Kairos (카이로스) — Claude Code 작업 가이드

베어링(주) 팀이 **내부에서 쓰는** 정부지원사업 자동화 웹 툴.
공고를 모으고(소싱) → 우리 회사 정보 기준으로 맞는 공고를 점수 매겨 추천하고 → 공고 첨부 양식을 받아 초안을 쓰고 → 사람이 리뷰해서 제출까지 가는 흐름을 한 곳에서 관리한다.

## 먼저 읽을 문서 (순서대로)
1. `docs/PRD.md` — 무엇을, 왜. 범위(MVP / 이후), 사용자 시나리오, 기능 요구사항
2. `docs/ARCHITECTURE.md` — 스택, 데이터 모델, 소싱 API, 매칭·초안 파이프라인, 디렉토리 구조, 마일스톤
3. `docs/DESIGN.md` — 디자인 원칙, 토큰, 컴포넌트 명세, 화면별 레이아웃
4. `design/tokens.css` — 디자인 토큰 (CSS 변수). Tailwind 설정에 그대로 옮긴다
5. `design/reference/main-b.html` — **확정된 메인 화면(B안)**. 브라우저로 열어서 보고 픽셀 기준으로 삼는다
6. `design/reference/board-c.html` — "초안·리뷰" 탭의 보드 화면 참고용 (C안)

`design/source/*.dc.html`은 Claude Design 캔버스의 원본 소스다. 참고만 하고 앱 코드로 직접 가져오지 않는다.

## 작업 원칙
- **내부 툴이 1순위 목적이다.** 외부 판매용 기능(결제, 멀티테넌시, 마케팅 페이지)은 만들지 않는다.
- **한 번에 하나의 마일스톤만.** `docs/ARCHITECTURE.md`의 M0 → M1 → … 순서를 지킨다. 마일스톤마다 동작하는 상태로 커밋한다.
- **외부 API는 실제 명세를 먼저 확인한다.** 문서에 "확인 필요"로 표시된 필드명, 파라미터를 추측으로 하드코딩하지 않는다. 응답 샘플을 `fixtures/`에 저장하고 그걸로 파서를 테스트한다.
- **LLM 출력은 항상 구조화(JSON 스키마)하고 검증한다.** 점수·근거·초안 섹션 모두.
- **지어낸 사실을 초안에 넣지 않는다.** 회사 프로필에 없는 숫자, 실적, 고객사는 `【확인 필요: …】` 표시로 남긴다. 이건 디자인보다 중요한 규칙이다.
- 비밀값(API 키)은 `.env` 또는 화면의 "연결 키"(DB에 `AUTH_SECRET`으로 암호화)에만. 커밋 금지. `.env.example`을 유지한다. 키 값을 화면·로그에 그대로 내보내지 않는다(끝 4자리만).

## 디자인 원칙 요약 (자세한 건 DESIGN.md)
- 밝고 부드러운 "친근한 프리미엄". 결: 토스, 애플, 글로벌 SaaS
- **그라데이션은 화면당 한 곳**(홈의 "가장 잘 맞는 공고" 카드)만. 그라데이션 글자, 글로우, 장식용 블롭 금지
- 둥근 모서리, 알약형 버튼, Pretendard, 크고 존재감 있는 헤드라인
- 기술 티 내는 장식(모노스페이스, 터미널, 모눈) 금지. 이모지 아이콘 금지 → lucide 아이콘
- 시그니처: 접수 기간 타임라인 바 + 오늘 위치 점, 7일 이내면 주황

## 명령어 (M0 확정)
```
pnpm install          # 의존성 + prisma generate (postinstall)
pnpm db:up            # 로컬 Postgres (docker, 호스트 포트 5433)
pnpm db:migrate       # 마이그레이션 + 클라이언트 생성
pnpm db:seed          # 회사 1개(베어링(주)) 생성
pnpm db:deploy        # 배포용: migrate deploy + 시드(회사 없을 때만). Amplify 빌드의 preBuild
pnpm dev              # 개발 서버 http://localhost:3000
pnpm test             # vitest
pnpm lint / pnpm typecheck / pnpm build
pnpm sync [소스]      # 공고 소싱 1회 (bizinfo | kstartup | boards, 생략하면 전부). 키 없는 소스는 건너뜀
pnpm sync:probe       # 실제 API 응답을 fixtures/<소스>/live-YYYYMMDD.json으로 저장 (DB에 안 씀)
pnpm worker           # pg-boss 워커(KST): 매일 08:00 기업마당, 08:05 K-Startup, 08:10 연결한 게시판, 평일 매시 30분 점수 대기분, 월 09:00 다이제스트, 매일 09:05 마감 알림
pnpm score [개수|all] # 하드필터 다시 + 점수 대기 공고 LLM 점수 (기본 SCORE_MAX_PER_RUN=30)
pnpm boards:refill    # 접수 기간이 빈 게시판 공고를 다시 읽어(공고문 첨부 포함) 빈 칸만 채움
pnpm notify <digest|deadline> [--dry-run]  # Slack 다이제스트·마감 알림 지금 보내기 (--dry-run은 출력만)
pnpm draft <공고 id|application id>  # 첨부 받기 → 양식 읽기 → 섹션별 초안 (새 버전, 상태는 안 바꿈)
pnpm forms:measure    # fixtures/forms/ 양식 샘플 파싱 측정 (샘플은 커밋 안 함)
```

처음 세팅: `cp .env.example .env` → `AUTH_SECRET`(openssl rand -base64 32) 채우기 → 위 순서대로.
로그인은 이메일·비밀번호(`/login`, 가입은 `?mode=signup`). 가입할 때 **소속 회사**를 넣고, 등록된 `Company.name`과 맞아야 한다((주)·주식회사·띄어쓰기 무시, `normalizeCompanyName`). 회사를 새로 만들지는 않는다. 처음엔 `pnpm db:seed`로 회사를 만든 뒤 가입한다. 배포 주소는 Amplify Access control로 한 겹 더 막아도 된다.

## 구현 메모 (M0에서 정한 것)
- Next.js 16: `middleware`는 `src/proxy.ts`(지금은 없음). `cacheComponents` 켜져 있음 → DB를 읽는 컴포넌트는 `<Suspense>` 안에 두고 `connection()`/`requireUser()`로 요청 시점에 읽는다. 버전별 API는 `node_modules/next/dist/docs/`를 먼저 본다 (AGENTS.md)
- 데이터 접근 전 `src/server/session.ts`의 `requireUser()`: 요청 시점으로 만들고(`connection()`), 세션 쿠키(`kairos_session`, DB `Session.id`=토큰 sha256)로 사용자를 찾고(없으면 `/login`), 연결 키를 읽는다. `CurrentUser.companyId`로 같은 회사 데이터만. 비밀번호는 `src/server/auth/password.ts`(scrypt). 예전 공용 팀 계정(`team@kairos.local`)은 기록으로만 남고 로그인할 수 없다(같은 이메일로 가입하면 이어받음)
- Tailwind v4: 토큰 매핑은 `src/app/globals.css`의 `@theme inline`. 값 자체는 `design/tokens.css`만 고친다. 기본 스타일은 `@layer base` 안에(밖에 두면 유틸리티를 덮어씀)
- Prisma 7: 설정은 `prisma.config.ts`, 클라이언트는 `src/generated/prisma`(커밋 안 함), `@prisma/adapter-pg` 사용
- 상태 표기·색은 `src/lib/status.ts`, KST 날짜 계산은 `src/lib/kst.ts`, D-day·타임라인은 `src/lib/dday.ts`만 쓴다
- 이 Mac은 Node 20 → vitest는 3.x, pg-boss는 10.x로 고정 (최신은 Node 22 필요)
- 폼은 `<form action={action} onSubmit={submitWith(action)}>` (`src/components/form/useFormAction.ts`). React 19가 액션 후 폼을 비워 검증 오류 때 입력이 사라지는 걸 막는다
- `usePathname()` 쓰는 클라이언트 컴포넌트는 Suspense 안에 둔다 (cacheComponents 빌드 오류)
- 스키마를 바꾸면 dev 서버를 재시작한다 (전역에 남은 이전 Prisma 클라이언트)

## 연결 키
- `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`, `BIZINFO_API_KEY`, `DATA_GO_KR_SERVICE_KEY`는 `src/server/secrets.ts`의 `secret(name)`으로만 읽는다 (`process.env` 직접 읽기 금지). `.env`가 먼저, 없으면 화면에서 넣은 값(`AppSecret`, AES-256-GCM)
- 화면: 회사 프로필 → "연결 키" 탭, 공고 소스 화면의 기본 소스 줄·Anthropic 안내. 저장 전에 실제로 한 번 확인(`src/server/secretCheck.ts`). Slack은 메시지가 가므로 주소 형식만
- 캐시는 `ensureSecrets()`(1분). 웹은 `requireUser()`가, 워커는 작업마다, tsx 스크립트는 `main()` 첫 줄에서 부른다. 새 스크립트도 그렇게
- `AUTH_SECRET`을 바꾸면 저장된 키를 못 읽는다 → 화면에 "다시 넣어 주세요"

## 소싱 (M1)
- 확인된 API 명세: `docs/sources/bizinfo.md`, `docs/sources/kstartup.md`. "아직 확인 못 한 것"은 실제 응답(`pnpm sync:probe`)으로 확인 후 파서를 좁힌다
- 흐름: `src/server/sources/{bizinfo,kstartup}.ts`(fetch+파싱) → `upsert.ts`(source+externalId upsert, contentHash 변경 감지, dedupeKey로 소스 간 중복을 `duplicateOfId`로 묶음) → `SyncRun` 기록
- URL 수동 추가: `fetchPage.ts`(내부망 차단, 메뉴·스크립트 뺀 본문 전체) → `manual.ts`(LLM 구조화, 프롬프트 `src/server/prompts/url-extract.v2.ts`). 본문에 접수 기간이 없으면 `noticeAttachment.ts`가 공고문 첨부(이름에 "공고", 양식 아님)를 받아 `<attachment>`로 같이 넣는다(bipa.kr처럼 본문 없이 첨부만 있는 게시판) → 사람이 확인 후 저장. `ANTHROPIC_API_KEY`가 없으면 직접 입력
- 게시판 소스: 헤더 "공고 관리하기" → `/announcements/sources`(연결된 소스·가져온 뉴스레터 목록, "새 소스 연결하기"·"지금 모두 가져오기") → `/announcements/sources/new`에서 종류(게시판·뉴스레터, `ConnectSource`의 `KINDS`)를 골라 연결. `boards.ts`의 `checkBoard()`가 목록 → 새 링크만 LLM(`board-list.v1`, 번호로만 고름) → 글마다 `extractFromUrl` → `source=board`로 저장. 판단 끝난 링크는 `BoardSource.knownLinks`. 자세한 건 ARCHITECTURE 4.3.1
- 게시판 테스트용 목록 원본은 `fixtures/boards/`. 글을 스크립트로 여는 게시판은 연결 때 거절한다(`scriptRows`/`linkRows`)
- `manual.ts`·`boards.ts`·`boardList.ts`는 워커에서도 쓰므로 `server-only`를 붙이지 않는다
- 뉴스레터: "새 소스 연결하기" → 뉴스레터(`/announcements/sources/new?type=newsletter`)(지금은 피트페이퍼 링크) → `featpaper.ts`(PDF+링크 상자) → `newsletterPdf.ts`(표 줄 묶기) → `newsletter.ts`(모든 줄을 `source=newsletter` 공고로, 기업마당·K-Startup 링크는 그 ID로 중복 처리). 뉴스·투자는 점수 안 매김. 자세한 건 ARCHITECTURE 4.3.2

## 매칭 (M2)
- 흐름: 소싱 → `src/server/matching/run.ts`의 `refreshMatches()`(하드필터 `hardFilter.ts`, LLM 없음) → `scorePending()`(LLM, 프롬프트 `src/server/prompts/score.v1.ts`). 프롬프트를 고치면 새 버전 파일을 만들고 `promptVersion`이 바뀌게 한다
- 1차 분류는 상세 화면에서: 분류 전(new·triage) 공고 상세 아래 `TriageBar`(관심 → `interested` / 관심 없음 → `excluded` + 사유 칩 / 건너뛰기) → 다음 분류 전 공고로. 순서는 `unsortedQueue()`(목록 "분류 전" 탭 기본 정렬과 같음), 목록의 "분류 시작"이 첫 공고. 되돌리기 토스트는 `(app)/layout`의 `TriageProvider`(`components/announcements/Triage.tsx`, 액션 `quickTriage`). 목록 줄에는 분류 버튼을 두지 않는다(제목만 보고 고르지 않게). 사이드바 "관심 공고" = `/announcements?status=interested`
- 하드필터는 확실할 때만 제외한다. 애매하면 통과 + `filterNotes`(→ LLM 입력, 상세의 "확인 필요")
- 상태 전이는 `src/lib/transitions.ts`로 서버에서만 검증, 변경은 `setStatus()`로 해서 `ApplicationEvent`가 남게 한다. 사람이 정한 상태는 하드필터가 덮어쓰지 않는다(`autoExcluded`만 자동 복귀)
- 회사 프로필·제외 규칙 저장 → `refreshMatches()` 바로. 소싱·URL 추가 → 규칙 검사 바로, 점수는 `runInBackground()`로 응답 뒤에
- `src/server/{llm,company,matches,matching/*,notify/*}.ts`는 tsx 스크립트·워커에서도 쓰므로 `server-only`를 붙이지 않는다

## 알림 (M3)
- `src/server/notify/`: `slack.ts`(웹훅 발송, 주소는 hooks.slack.com만 · 개발 중엔 localhost 허용), `messages.ts`(문구, 순수 함수·테스트), `run.ts`(대상 조회·발송·기록)
- 다이제스트 대상은 홈 헤드라인과 같은 `focusWhere()`. 일정 발송은 `Notification.dedupeKey = digest:<그 주 월요일>`로 주 1회, 수동은 매번
- 마감 알림은 초안 작성 중·리뷰 중만, 구간(7/3/1)마다 한 번(`DeadlineAlert`). 하루를 놓치면 다음 구간에서 보낸다. 발송 실패는 기록만 하고 다음 실행에서 다시
- 앱: 회사 프로필 → "Slack 알림" 탭에서 미리보기·지금 보내기·보낸 기록
- 로컬 확인은 가짜 웹훅(`SLACK_WEBHOOK_URL=http://127.0.0.1:<port>/…`)으로. 실제 팀 채널로 테스트 발송은 사람이 한다

## 초안 (M4)
- 흐름: drafting 전환·"초안 만들기" → `createDraft()` → `runInBackground({ kind: "draft-run" })`: `drafting/attachments.ts`(상세 페이지 다시 열어 새 링크 → 내려받기 → `storage/` → `server/docs` 파싱) → `form-sections.v1`(섹션·평가 기준·제출 서류) → `draft-section.v1`(섹션마다). 자세한 건 ARCHITECTURE 6절
- 파서는 Node만 (`src/server/docs/`, doc-worker 없음 — `docs/forms-parsing.md`). unpdf는 0.12.1 고정 (2.x는 Node 22 필요)
- 양식 채우기(`templateSource=fill`): 짧은 HWP 서식(참여의향서·신청서)에서 `src/server/docs/hwpForm.ts`의 `readHwpForm()`이 표의 "제목 칸 → 값 칸"(빈 칸, `(휴대전화)` 머리말 칸, `(예시)` 칸, `□` 보기 칸)을 칸으로 찾으면 섹션 대신 칸(`DraftSection.field`)을 만들고 `form-fill.v1`로 한 번에 채운다. 모르는 칸은 빈 값 + 확인 필요(HWP에 【확인 필요】 글자를 넣지 않음). 화면은 `FormFillSheet`, 받기는 `/api/drafts/[id]/export?format=hwp` → `fillHwp()`(원본 레코드를 그대로 두고 값 칸 문단만 고침, 고른 보기는 □→■). 인적사항은 회사 프로필 "신청서 인적사항"(주소·대표자·담당자·연락처). HWPX 양식은 아직 서술형으로
- `【확인 필요: …】` 찾기·하이라이트·글자 수는 `src/lib/needsCheck.ts`만 쓴다. 색은 토큰 `check-bg`/`check-fg`
- 초안 화면 `/applications/[id]/draft`: 작업 중이면 `DraftPoller`가 3초마다 `router.refresh()`
- `src/server/drafting/*`, `src/server/docs/*`는 tsx 스크립트에서도 쓰므로 `server-only`를 붙이지 않는다 (`src/server/drafts.ts`는 화면 전용)
- LLM 없이 화면 확인: 가짜 Anthropic 서버를 띄우고 `.env`에 `ANTHROPIC_BASE_URL=http://127.0.0.1:<port>` + 아무 키. 끝나면 되돌린다

## 보드·리뷰·내보내기 (M5)
- 상태 변경은 전부 `src/server/applications.ts`의 `transition()`으로 (초안 자동 생성·리뷰 요청 Slack 같은 부수 효과가 여기 한 곳에)
- 보드 `/board`: `src/server/board.ts` + `components/board/BoardView.tsx`(드래그 + "옮기기" 메뉴, 서버 거절 시 원위치). 자동화 도구의 마우스 드래그로는 HTML5 DnD가 안 되니 확인은 JS로 `DragEvent`+`DataTransfer`를 보낸다
- 코멘트 `ReviewComment`(섹션 단위), 리뷰어 `Application.reviewers`, AI 원본 `DraftSection.aiContent` → "AI 초안과 비교"(`src/lib/diff.ts`)
- 내보내기 `src/server/export/`: DOCX(`docx`)·MD는 `/api/drafts/[id]/export?format=`, PDF는 `/print/drafts/[id]`에서 브라우저 인쇄
- `<details>` 팝오버는 `src/components/ui/useDismiss.ts`로 바깥 클릭·Esc 닫기
- "로/으로"는 `withRo()` (`src/lib/format.ts`)
- Tailwind 브레이크포인트는 **rem으로만** (`--breakpoint-xl: 75rem`, 임의 값도 `min-[87.5rem]:`). px로 쓰면 sm/md(rem)보다 앞에 정렬돼 덮어써진다

## 구성원·요청
- 구성원 = 같은 `companyId`의 가입한 사용자(`passwordHash` 있음). 회사 프로필 → "구성원" 탭(목록, 내 이름·Slack 멤버 ID, 로그아웃)
- 요청 `WorkRequest`(작성·보강·리뷰·기타, 지원 단위 + 섹션 선택, 기한은 KST 그날 끝): `src/server/requests.ts`에서만 만들고 바꾼다(받는 사람·지원·섹션이 내 회사 것인지 확인). 리뷰 요청은 리뷰어로도 지정
- 화면: 초안 화면 오른쪽 "요청" 패널(`RequestForm`·`RequestCard`), 사이드바 "요청" `/requests`(받은/보낸 × 진행 중/끝남, 배지 = 나에게 온 진행 중). 받은 사람은 완료·거절(사유 필수), 보낸 사람은 취소, 끝난 건 둘 다 다시 열기
- 알림은 `runInBackground({ kind: "work-request" })` → `sendWorkRequest()`(팀 채널 웹훅, Slack 멤버 ID가 있으면 `<@U…>` 멘션). 표기는 `src/lib/requests.ts`

## 응답 뒤 작업
- 초안·점수·게시판 확인·리뷰 요청 Slack은 `src/server/jobs/background.ts`의 `runInBackground(job)`으로만 (`after()` 직접 쓰지 않기). 작업 내용은 `jobs/handlers.ts`의 `runJob()` 한 곳
- 기본(로컬)은 `after()`로 웹에서 바로. `BACKGROUND_JOBS=queue`면 pg-boss `background` 큐 → 워커가 처리 (Amplify는 서버리스라 응답 뒤 작업이 보장되지 않음). 로컬에서 큐 모드를 보려면 `pnpm worker`를 같이 띄운다
- 새 작업 종류는 `BackgroundJob` 유니온에 추가. 데이터는 JSON으로 직렬화되니 id만 넘긴다

## 배포 (AWS: Amplify + Fargate)
- 웹: Amplify Hosting, `amplify.yml`. Next 16은 Amplify의 Next.js 자동 지원(15까지) 밖이라 **배포 명세**로 올린다: `NEXT_OUTPUT=standalone pnpm build` → `scripts/amplify-bundle.mjs`가 `.amplify-hosting/`(compute/default + static + deploy-manifest) 생성. 컴퓨트 묶음은 220MB 제한(지금 약 55MB) → `next.config.ts`의 `outputFileTracingExcludes`
- Amplify 콘솔 환경 변수는 SSR 런타임에 안 들어간다 → `amplify-bundle.mjs`의 `RUNTIME_ENV`만 `server-env.json`으로 묶는다. 런타임에 쓰는 환경 변수를 새로 만들면 거기에도 추가
- 파일 경로를 `process.env` 등 동적 값으로 만들면 Turbopack이 프로젝트 전체를 묶는다(.env까지) → `/*turbopackIgnore: true*/` 또는 고정 하위 폴더로
- 워커·AWS 리소스: `infra/aws/kairos.yml`(CloudFormation: S3·ECR·ECS Fargate·IAM), 이미지 `Dockerfile.worker`, 배포 `.github/workflows/worker.yml`(main 푸시 → ECR → 서비스 재배포). 워커 비밀값은 SSM `/kairos/*`
- DB는 Neon. 웹은 풀러 주소 `DATABASE_URL`, 마이그레이션·워커는 직접 주소 `DATABASE_URL_UNPOOLED`
- 파일은 `STORAGE_DRIVER=s3`(Amplify 컴퓨트 역할·ECS 작업 역할로 접근, 키 없음)
- 순서는 `docs/DEPLOY.md`. 워커·빌드가 런타임에 쓰는 `prisma`·`tsx`·`dotenv`는 dependencies에 둔다
- Slack 링크 주소: `APP_BASE_URL` (웹·워커 둘 다)
