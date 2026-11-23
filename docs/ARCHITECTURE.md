# ARCHITECTURE — 지원사업 데스크 (가칭)

PRD의 기능을 어떻게 만들지. 1절 스택은 M0(2026-11-23)에서 아래처럼 확정했다.

> **M0 확정 버전**: Next.js 16.4 (App Router, `cacheComponents` + Partial Prefetching, `src/proxy.ts`) · React 19.3 · Tailwind CSS 4.3 (CSS `@theme`) · Prisma 7.10 (`prisma.config.ts`, `@prisma/adapter-pg`) · PostgreSQL 17 (docker, 호스트 5433) · Auth.js v5 beta (`next-auth@5.0.0-beta.32`, JWT 세션 + Prisma 어댑터) · lucide-react · Pretendard(npm, variable dynamic subset) · vitest.
> 인증: Google만 + `ALLOWED_EMAIL_DOMAIN` 화이트리스트(`email_verified` 필수, 도메인 미설정이면 전원 거부). 개발 전용 로그인(`AUTH_DEV_LOGIN=1`, production에서는 비활성).
> Prisma 스키마는 M0에서 Auth.js 테이블 + `Company`만 만들었다. 나머지 모델은 해당 마일스톤에서 3절 이름 그대로 추가한다.

---

## 1. 스택 제안

| 영역 | 선택 | 이유 |
|---|---|---|
| 웹 | **Next.js (App Router) + TypeScript** | 화면과 API를 한 저장소에서. 서버 액션으로 폼 처리 단순화 |
| 스타일 | **Tailwind CSS** + `design/tokens.css`의 변수 | 토큰을 Tailwind theme에 매핑 |
| UI 부품 | Radix UI primitives(필요한 것만) + 직접 만든 컴포넌트 | 접근성 확보, 디자인은 우리 것 |
| 아이콘 | lucide-react | 한 세트, stroke 2 |
| 폰트 | Pretendard (self-host, `pretendard` npm 패키지) | |
| DB | **PostgreSQL** + Prisma | 로컬은 docker compose |
| 잡 큐 | **pg-boss** (Postgres 기반) | 별도 Redis 없이 소싱·매칭·초안 잡 처리 |
| 스케줄 | pg-boss cron (매일 08:00 소싱, 월 09:00 다이제스트) | |
| LLM | Anthropic API (`@anthropic-ai/sdk`), 모델은 env로 | 점수·초안 모두 JSON 출력 강제 |
| 인증 | Auth.js + Google, 팀 도메인 화이트리스트 | |
| 파일 저장 | 로컬 디스크(개발) → S3 호환(Cloudflare R2 등) | 첨부, 업로드 문서, 내보내기 |
| 문서 처리 | **M4에서 결정**: Node만으로 갈지, Python `doc-worker` 추가할지 | HWP 파싱은 Python 생태계(pyhwp 등)가 더 성숙. 아래 6절 |
| 배포 | 단일 VM + docker compose (web, worker, postgres) | 내부 툴, 4명 사용 |

## 2. 구성

```
┌───────────────┐      ┌────────────────────┐
│  Next.js web  │◀────▶│ PostgreSQL         │
│  (UI + API)   │      │  + pg-boss 테이블   │
└──────┬────────┘      └─────────▲──────────┘
       │ enqueue                  │
┌──────▼──────────────────────────┴─────────┐
│ worker (Node, 같은 저장소)                  │
│  sync:bizinfo / sync:kstartup / sync:url   │
│  match:score                               │
│  docs:fetch / docs:parse                   │
│  draft:generate / draft:regenerate-section │
│  notify:slack-digest / notify:deadline     │
└──────┬─────────────────────────────────────┘
       │ (M4, 필요 시)
┌──────▼─────────┐
│ doc-worker      │  HWP/HWPX/DOCX/PDF → 구조화 텍스트
│ (Python, 옵션)  │
└─────────────────┘
```

## 3. 데이터 모델 (요약)

Prisma 스키마로 옮길 때 이름은 그대로 쓴다. 모든 테이블에 `id`(cuid), `createdAt`, `updatedAt`.

```
Company            회사 (지금은 1개)
  name, foundedAt, region, ksicCodes[], bizType(법인/개인), certifications[],
  headcount, revenueBand, ceoBirthYear?, description

ItemCard           주력 아이템 (예: ONDECKK)
  companyId, name, problem, solution, customer, differentiation,
  traction(자유 텍스트, 숫자는 사람이 넣은 것만), links[]

LibraryDoc         문서 라이브러리
  companyId, kind(사업자등록증|사업계획서|IR|기타), title, fileKey,
  extractedText, chunks(→ LibraryChunk, 임베딩은 이후)

ExclusionRule      제외 규칙
  companyId, kind(keyword|region|target|industry), value, note

Announcement       공고 (소스 무관 정규화)
  source(bizinfo|kstartup|manual|newsletter), externalId, url,
  title, organization, executingOrg, summary, target, regionLimit?,
  applyStart?, applyEnd?, supportAmountText?, category, hashtags[],
  raw(JSON 원본), dedupeKey, lastSeenAt
  @@unique([source, externalId])

Attachment         공고 첨부
  announcementId, fileName, url, fileKey?, mime, kind(공고문|양식|기타),
  parsed(JSON: 섹션 구조), parseStatus

Match              공고 × 회사 매칭 결과
  announcementId, companyId, hardFilterPassed, excludeReason?,
  score(0-100)?, reasons(JSON), risks(JSON), suggestedItemCardId?,
  model, promptVersion, scoredAt

Application        진행 단위 (상태 파이프라인의 주인공)
  announcementId, companyId, status(new|triage|drafting|review|submitted|
  result_pass|result_fail|excluded), ownerId?, reviewerIds[],
  excludedReason?, submittedAt?, submittedFileKey?, resultNote?

Draft              초안 (Application당 여러 버전)
  applicationId, version, templateSource(form|default:<type>),
  sections(→ DraftSection)

DraftSection
  draftId, order, key, title, guidance(작성 요령), limitChars?,
  content(markdown), needsCheck(JSON: 【확인 필요】 목록), generatedBy(ai|human)

ReviewComment
  draftSectionId, authorId, body, resolvedAt?

RequiredDoc        제출 서류 체크리스트
  applicationId, name, libraryDocId?, status(ready|missing|na)

User               팀원 (Auth.js)
SyncRun            소싱 실행 기록 (source, startedAt, fetched, created, updated, error?)
```

상태 전이: `new → triage → drafting → review → submitted → result_*`, 어느 단계에서든 `excluded`(사유 필수). 전이는 서버에서만 검증한다.

## 4. 소싱

### 4.1 기업마당 API
- 엔드포인트: `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do`
- 인증: `crtfcKey` (기업마당 사이트에서 API 신청 후 발급)
- 공식 문서: `https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiDetail.do`
- 응답(JSON)의 공고 배열과 주요 필드 (공개된 오픈소스 클라이언트 기준, **실제 응답으로 재확인 필요**):
  - `pblancId` 공고 ID → `externalId`
  - `pblancNm` 공고명, `bsnsSumryCn` 사업 요약(HTML 포함 가능)
  - `reqstBeginEndDe` 신청 기간(문자열 범위 → `applyStart/applyEnd`로 파싱, 형식 확인 필요)
  - `jrsdInsttNm` 소관 기관, `excInsttNm` 수행 기관
  - `pblancUrl` 상세 URL, `trgetNm` 지원 대상, `hashtags`
  - `pldirSportRealmLclasCodeNm` / `pldirSportRealmMlsfcCodeNm` 지원 분야 대/중분류
  - 분야 코드 예: 금융 PLD0001, 기술 PLD0002, 인력 PLD0003, 수출 PLD0004, 내수 PLD0005, 창업 PLD0006, 경영 PLD0007, 기타 PLD0008
- 요청 파라미터(dataType, 건수, 분야, 해시태그, 페이지)의 **정확한 이름은 공식 문서에서 확인 후 구현**
- 첨부파일 URL이 응답에 있는지 확인. 없으면 상세 페이지를 파싱한다

### 4.2 K-Startup (공공데이터포털)
- 데이터셋: 창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)_조회서비스, ID `15125364`
- 오퍼레이션: `getAnnouncementInformation01` (지원사업 공고: 공고명, 접수기간, 지역, 신청대상, 모집 진행 여부 등)
- 인증: 공공데이터포털 `serviceKey` (활용신청 필요, 개발계정 일 10,000건)
- 베이스 URL, 파라미터, 응답 필드명은 **data.go.kr 명세 페이지에서 확인 후 구현** (추측 금지)
- 알려진 주의점: 지역 필터 파라미터가 서버에서 적용되지 않는 사례가 있다고 함 → 받아온 뒤 클라이언트에서 한 번 더 거른다

### 4.3 URL 수동 추가
- `POST /api/announcements/from-url` → 페이지 fetch → 본문 추출(readability) → LLM으로 공고 필드 구조화(JSON 스키마) → 사람이 확인 후 저장

### 4.4 공통 처리
- 수집 → `Announcement` upsert(`source+externalId`) → `dedupeKey = normalize(title) + organization + applyEnd`로 소스 간 병합 → 신규·변경분만 `match:score` 큐에 넣기
- 원본 응답은 `raw`에 저장하고, 개발 중 샘플은 `fixtures/bizinfo/*.json`, `fixtures/kstartup/*.json`로 커밋해서 파서 테스트에 쓴다
- 실패해도 다른 소스는 계속. `SyncRun`에 기록

## 5. 매칭·점수

### 5.1 하드필터 (규칙, LLM 없이)
| 조건 | 데이터 |
|---|---|
| 마감 지남 | `applyEnd < today` |
| 업력 | 공고 텍스트의 "업력 N년 이내/이상" 추출(정규식 + LLM 보조) vs `Company.foundedAt` |
| 지역 | `regionLimit` vs `Company.region` |
| 대상 | 예비창업자 전용, 소상공인 전용 등 |
| 제외 규칙 | `ExclusionRule` |

탈락하면 `Match.hardFilterPassed=false`, `excludeReason`을 사람이 읽을 문장으로 저장("업력 3~7년 요건 미달"). 화면에서는 "제외" 칩 + 흐리게.

### 5.2 LLM 점수
입력: 회사 프로필 요약, 아이템 카드들, 지원 이력 요약(최근 결과 포함), 공고 정규화 필드 + 본문 요약.
출력 JSON 스키마:

```json
{
  "score": 0,
  "reasons": ["string (최대 3개, 각 30자 안팎)"],
  "risks": ["string (확인이 필요한 요건)"],
  "suggestedItemCard": "string | null",
  "eligibility": "eligible | uncertain | ineligible"
}
```

- `eligibility = ineligible`이면 점수와 무관하게 제외 후보로 표시(사람이 확정)
- 프롬프트는 `src/server/prompts/score.v1.ts`처럼 버전 관리, `Match.promptVersion`에 기록
- 비용 관리: 하드필터 통과분만 점수화, 공고 본문은 요약본 사용

### 5.3 정렬·홈 구성
- 리스트 정렬: `score` 내림차순, 같으면 `applyEnd` 오름차순
- 홈 히어로("가장 잘 맞는 공고"): 진행 가능 상태(`new`, `triage`, `drafting`) 중 최고 점수 1개
- "마감 임박" 카드: 진행 중(`drafting`, `review`) 중 D-day 최소
- "새로 맞는 공고" 카드: 지난 24시간 내 `new` 중 최고 점수
- 헤드라인 숫자 "이번 주에 챙길 공고 N개": 7일 이내 마감 또는 점수 85+ 이면서 상태가 `new | drafting | review`

## 6. 문서 다운로드·파싱·초안 (M4)

1. 진행 결정(`drafting` 전환) → `docs:fetch`: 첨부 다운로드 → 저장
2. `docs:parse`: 형식별 텍스트·구조 추출
   - DOCX: `mammoth`(Node) 또는 python-docx
   - PDF: `pdfjs`(Node) 또는 pdfplumber
   - HWPX: zip 안 XML 직접 파싱 가능
   - HWP(구형 바이너리): Node 지원이 약함 → Python `pyhwp`(hwp5txt/hwp5html) 기반 `doc-worker` 또는 LibreOffice 변환 경유. **M4 첫 작업으로 실제 공고 양식 10개로 성공률 측정 후 결정**
3. 양식에서 섹션 목록(제목, 작성 요령, 분량 제한) 추출 → 실패 시 기본 템플릿 선택(`templates/startup-package.ts`, `voucher.ts`, `rnd.ts`)
4. `draft:generate`: 섹션별로 LLM 호출
   - 입력: 섹션 제목·요령·분량, 공고 평가 기준, 회사 프로필, 추천 아이템 카드, 문서 라이브러리 검색 결과(처음엔 키워드 검색, 이후 임베딩)
   - 규칙: 입력에 없는 사실·수치 금지 → `【확인 필요: 무엇】`으로 남김. 분량 제한 준수. 과장어 금지
   - 출력 JSON: `{ "content": "markdown", "needsCheck": ["..."] }`
5. 제출 서류 추출 → `RequiredDoc` 생성, 라이브러리와 이름 매칭

## 7. 알림
- Slack Incoming Webhook (env `SLACK_WEBHOOK_URL`)
- 주간 다이제스트 포맷 (팀 요청: 링크·공고·마감만):
  ```
  이번 주에 챙길 공고 3개
  • <url|2027년 초기창업패키지> — 12.08 마감 (D-15) · 적합 92 · 초안 작성 중
  • <url|부산 SW기업 성장지원사업> — 11.28 마감 (D-5) · 리뷰 중
  • <url|2027년 AI 바우처 공급기업> — 12.19 마감 · 새 공고
  전체 보기: <앱 홈 URL>
  ```
- 마감 알림: 진행 중 공고 D-7/D-3/D-1, 하루 1회

## 8. 디렉토리 구조 (제안)

```
/
├─ CLAUDE.md
├─ docs/                     PRD, ARCHITECTURE, DESIGN
├─ design/                   tokens.css, reference/*.html, source/*.dc.html
├─ fixtures/                 bizinfo/, kstartup/, forms/ (실제 응답·양식 샘플)
├─ prisma/schema.prisma
├─ src/
│  ├─ app/
│  │  ├─ (app)/page.tsx                홈 (B안)
│  │  ├─ (app)/announcements/page.tsx  전체 공고
│  │  ├─ (app)/announcements/[id]/     공고 상세
│  │  ├─ (app)/board/                  초안·리뷰 보드
│  │  ├─ (app)/applications/[id]/draft 초안 에디터
│  │  ├─ (app)/history/                지원 이력
│  │  ├─ (app)/company/                회사 프로필
│  │  └─ api/...
│  ├─ components/ui/          Button, Chip, ScoreBadge, TimelineBar, Card, Tabs, Sidebar ...
│  ├─ components/home/        FocusHeroCard, UrgentCard, NewMatchCard, AnnouncementRow
│  ├─ server/
│  │  ├─ sources/             bizinfo.ts, kstartup.ts, url.ts, normalize.ts, dedupe.ts
│  │  ├─ matching/            hardFilter.ts, score.ts
│  │  ├─ drafting/            parseForm.ts, templates/, generate.ts
│  │  ├─ notify/              slack.ts
│  │  ├─ prompts/             score.v1.ts, draft-section.v1.ts, url-extract.v1.ts
│  │  └─ jobs/                pg-boss 등록·핸들러
│  └─ lib/                    dday.ts, status.ts, format.ts
└─ worker.ts                  pg-boss 워커 엔트리
```

## 9. 환경 변수

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAIL_DOMAIN=
BIZINFO_API_KEY=
DATA_GO_KR_SERVICE_KEY=
ANTHROPIC_API_KEY=
LLM_MODEL_SCORE=
LLM_MODEL_DRAFT=
SLACK_WEBHOOK_URL=
STORAGE_DRIVER=local|s3
S3_ENDPOINT= S3_BUCKET= S3_ACCESS_KEY= S3_SECRET_KEY=
APP_BASE_URL=
```

## 10. 마일스톤 (순서대로, 각 단계 끝에 동작 확인)

| # | 내용 | 완료 기준 |
|---|---|---|
| **M0** | 저장소 세팅: Next.js, Tailwind+토큰, Prisma+Postgres(docker), Auth.js(Google), 레이아웃(사이드바) | 로그인 후 빈 홈이 B안 사이드바·헤더와 같은 모양으로 뜬다 |
| **M1** | 회사 프로필·아이템 카드·제외 규칙 CRUD, 공고 모델, 기업마당·K-Startup 소싱 잡, URL 수동 추가 | `pnpm sync`로 실제 공고가 DB에 쌓이고 전체 공고 화면에 나온다. fixtures 기반 파서 테스트 통과 |
| **M2** | 하드필터 + LLM 점수, 홈 B안 완성(히어로·보조 카드·리스트·필터 탭), 공고 상세, 상태 변경 | 홈이 `design/reference/main-b.html`과 시각적으로 일치. 제외 사유가 보인다 |
| **M3** | Slack 주간 다이제스트, 마감 알림 | 월요일 09:00 다이제스트가 팀 채널에 온다(수동 트리거로 확인) |
| **M4** | 첨부 다운로드, 양식 파싱(성공률 측정 후 doc-worker 결정), 섹션별 초안, 확인 필요 표시, 제출 서류 체크리스트 | 실제 공고 1건으로 초안이 섹션별로 생성되고 `【확인 필요】`가 하이라이트된다 |
| **M5** | 보드(C안 참고), 초안 에디터, 리뷰 코멘트·리뷰어·버전, 내보내기(DOCX/PDF) | 팀원이 리뷰 코멘트를 달고 해결 처리, DOCX로 내보낼 수 있다 |

## 11. 테스트
- 단위: 소스 파서(fixtures), 정규화·중복 제거, D-day 계산(KST 기준!), 하드필터, 상태 전이
- LLM: 응답 스키마 검증 실패 시 1회 재시도 후 오류 상태 저장. 프롬프트 변경 시 고정 공고 5건으로 점수 회귀 확인
- 날짜는 전부 `Asia/Seoul` 기준으로 계산하고 저장은 UTC
