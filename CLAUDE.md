# 지원사업 데스크 (가칭) — Claude Code 작업 가이드

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
- 비밀값(API 키)은 `.env`에만. 커밋 금지. `.env.example`을 유지한다.

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
pnpm dev              # 개발 서버 http://localhost:3000
pnpm test             # vitest
pnpm lint / pnpm typecheck / pnpm build
pnpm sync [소스]      # 공고 소싱 1회 (bizinfo | kstartup, 생략하면 둘 다). 키 없는 소스는 건너뜀
pnpm sync:probe       # 실제 API 응답을 fixtures/<소스>/live-YYYYMMDD.json으로 저장 (DB에 안 씀)
pnpm worker           # pg-boss 워커: 매일 08:00 기업마당, 08:05 K-Startup (KST)
```

처음 세팅: `cp .env.example .env` → `AUTH_SECRET`(openssl rand -base64 32) 채우기 → 위 순서대로.
구글 키가 없을 때는 `.env`에 `AUTH_DEV_LOGIN=1`이면 로그인 화면에 "개발용 계정으로 들어가기"가 나온다(production에서는 꺼짐).

## 구현 메모 (M0에서 정한 것)
- Next.js 16: `middleware` → `src/proxy.ts`. `cacheComponents` 켜져 있음 → 세션·DB를 읽는 컴포넌트는 `<Suspense>` 안에 두고 `connection()`/`requireUser()`로 요청 시점에 읽는다. 버전별 API는 `node_modules/next/dist/docs/`를 먼저 본다 (AGENTS.md)
- 인증: 데이터 접근 전 `src/server/session.ts`의 `requireUser()`. proxy는 낙관적 체크만
- Tailwind v4: 토큰 매핑은 `src/app/globals.css`의 `@theme inline`. 값 자체는 `design/tokens.css`만 고친다. 기본 스타일은 `@layer base` 안에(밖에 두면 유틸리티를 덮어씀)
- Prisma 7: 설정은 `prisma.config.ts`, 클라이언트는 `src/generated/prisma`(커밋 안 함), `@prisma/adapter-pg` 사용
- 상태 표기·색은 `src/lib/status.ts`, KST 날짜 계산은 `src/lib/kst.ts`, D-day·타임라인은 `src/lib/dday.ts`만 쓴다
- 이 Mac은 Node 20 → vitest는 3.x, pg-boss는 10.x로 고정 (최신은 Node 22 필요)
- 폼은 `<form action={action} onSubmit={submitWith(action)}>` (`src/components/form/useFormAction.ts`). React 19가 액션 후 폼을 비워 검증 오류 때 입력이 사라지는 걸 막는다
- `usePathname()` 쓰는 클라이언트 컴포넌트는 Suspense 안에 둔다 (cacheComponents 빌드 오류)
- 스키마를 바꾸면 dev 서버를 재시작한다 (전역에 남은 이전 Prisma 클라이언트)

## 소싱 (M1)
- 확인된 API 명세: `docs/sources/bizinfo.md`, `docs/sources/kstartup.md`. "아직 확인 못 한 것"은 실제 응답(`pnpm sync:probe`)으로 확인 후 파서를 좁힌다
- 흐름: `src/server/sources/{bizinfo,kstartup}.ts`(fetch+파싱) → `upsert.ts`(source+externalId upsert, contentHash 변경 감지, dedupeKey로 소스 간 중복을 `duplicateOfId`로 묶음) → `SyncRun` 기록
- URL 수동 추가: `fetchPage.ts`(내부망 차단, readability) → `manual.ts`(LLM 구조화, 프롬프트 `src/server/prompts/url-extract.v1.ts`) → 사람이 확인 후 저장. `ANTHROPIC_API_KEY`가 없으면 직접 입력
