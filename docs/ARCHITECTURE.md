# ARCHITECTURE — 지원사업 데스크 (가칭)

PRD의 기능을 어떻게 만들지. 1절 스택은 M0(2026-11-23)에서 아래처럼 확정했다.

> **M0 확정 버전**: Next.js 16.4 (App Router, `cacheComponents` + Partial Prefetching, `src/proxy.ts`) · React 19.3 · Tailwind CSS 4.3 (CSS `@theme`) · Prisma 7.10 (`prisma.config.ts`, `@prisma/adapter-pg`) · PostgreSQL 17 (docker, 호스트 5433) · Auth.js v5 beta (`next-auth@5.0.0-beta.32`, JWT 세션 + Prisma 어댑터) · lucide-react · Pretendard(npm, variable dynamic subset) · vitest.
> 인증: Google만 + `ALLOWED_EMAIL_DOMAIN` 화이트리스트(`email_verified` 필수, 도메인 미설정이면 전원 거부). 개발 전용 로그인(`AUTH_DEV_LOGIN=1`, production에서는 비활성).
> Prisma 스키마는 M0에서 Auth.js 테이블 + `Company`만 만들었다. 나머지 모델은 해당 마일스톤에서 3절 이름 그대로 추가한다.
> **M1 반영**: `ItemCard`, `ExclusionRule`, `Announcement`, `Attachment`, `SyncRun` 추가. `Announcement`에 3절 외 필드 `applyPeriodText`(날짜로 못 바꾸는 원문), `applyUrl`, `contentHash`(변경 감지), `duplicateOfId`(소스 간 중복 묶음), `firstSeenAt` 추가. 날짜는 KST 자정을 UTC로 저장. pg-boss는 Node 20 때문에 10.x, 스키마 `pgboss`. URL 추출 모델은 `LLM_MODEL_EXTRACT`(기본 `claude-opus-5-5`, effort low).
> **M2 반영**: `Match`에 `scoreStatus`(pending|running|scored|failed|skipped), `filterNotes`(통과했지만 확인 못 한 요건), `eligibility`, `scoredHash`(점수 때의 contentHash), `scoreError` 추가. `Application`은 `(announcementId, companyId)`로 `Match`와 1:1로 묶고 `autoExcluded`(하드필터 제외 → 조건이 바뀌면 자동 복귀), `statusChangedAt` 추가. 상태 변경은 `ApplicationEvent`(from, to, reason, userId)에 남긴다(PRD F3.4). 하드필터는 "확실할 때만 제외": 업력은 트랙 중 하나라도 맞으면 통과, 설립일·소재지가 없으면 통과 + 메모. 지역은 지역 필드 → 공고명 `[부산]` → 광역 지자체 이름의 주관 기관 순으로 본다. 점수는 하드필터 통과분만, 한 번에 `SCORE_MAX_PER_RUN`(기본 30)개, 마감 가까운 순. 회사 프로필이 바뀌어도 점수를 자동으로 다시 매기지 않는다(비용) → 상세의 "점수 다시 매기기". 새 공고 → 검토 전은 상세를 실제로 연 때(마운트 후 액션, 프리패치로 바뀌지 않게).

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
| 문서 처리 | **Node만 (M4 결정)**: HWPX·DOCX zip+XML, HWP 5 OLE+레코드, PDF unpdf | 실제 양식 12/12 성공. doc-worker는 배포용 HWP가 잦거나 원본 양식 채우기(F4.6) 때 다시 검토 — `docs/forms-parsing.md` |
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
       │ (M4에서 안 두기로 함)
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

- 본문은 메뉴·스크립트만 걷어 낸 페이지 전체 글자를 쓴다(readability는 기업마당 상세의 기관·신청기간 표를 잘라 냄). 60,000자를 넘을 때만 readability로 줄인다

### 4.3.1 게시판 소스 (직접 연결)
- 화면: 헤더 "새 공고 가져오기"(+) → `/announcements/sources`. 기본 API 소스(기업마당·K-Startup) 상태와 연결한 게시판 목록, 게시판 연결·지금 확인·매일 확인 끄기·연결 끊기, "지금 모두 가져오기"
- 모델 `BoardSource`(목록 주소, `knownLinks`, `checkingAt`, 마지막 결과). 찾은 공고는 `source=board`, `externalId=글 주소`, `boardSourceId`
- 흐름(`src/server/sources/boards.ts`의 `checkBoard`): 목록 HTML → `readListPage`(글 후보 링크 + 그 줄 글자) → 처음 보는 링크만 `board-list.v1`(LLM, 번호로만 고르게 해 주소를 지어내지 못함) → 고른 글을 `extractFromUrl`로 정리 → 마감 지난 글은 건너뛰고 저장. 한 번에 `BOARD_MAX_PER_RUN`개, 남은 건 다음 확인 때
- 판단이 끝난 링크(공고 아님·저장·이미 있음)는 `knownLinks`에 넣어 다시 LLM에 보내지 않는다. 글을 열다 실패한 건 남겨 두고 다시
- 글을 스크립트(onclick·`#`)로 여는 게시판(예: 중기부)은 연결할 때 거절하고 한 건씩 주소로 추가하게 안내한다
- 화면에서 연결·지금 확인은 `claimBoard`로 확인 중 표시를 먼저 잡고 `after()`에서 돌린다. 화면은 확인 중이면 4초마다 새로 읽는다
- 워커: 매일 08:10 KST 켜 둔 게시판 전부. 수동: `pnpm sync boards`

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

**결정 (2026-11-23):** doc-worker 없이 Node만으로 간다. 실제 양식 12개 12/12 성공 — `docs/forms-parsing.md`

1. 진행 결정(`drafting` 전환, 또는 초안 화면의 "초안 만들기") → 초안 새 버전(`Draft.status=preparing`) → 응답 뒤(`after()`)에 `runDraft()`
2. 첨부 받기 `src/server/drafting/attachments.ts`
   - 기업마당 다운로드 링크는 토큰(`downloadToken`, iat)이 있어 만료된다 → **받을 때마다 상세 페이지를 다시 열어** 새 링크를 얻는다 (`links.ts`: 기업마당 `.file_name` + `fileDown.do`, K-Startup `.board_file a.file_bg[title]` + `/afile/fileDownload/`, 그 밖은 확장자 링크)
   - 같은 파일 이름이면 링크만 바꾼다. 내부망 차단·리다이렉트마다 재검사·30MB 제한(`download.ts`). xlsx·zip·이미지는 받지 않는다
   - 저장: `storage/attachments/<sha256>.<확장자>` (`STORAGE_DIR`). 앱에서는 `/api/attachments/[id]`로 내려받는다
3. 글자 뽑기 `src/server/docs/`: HWPX·DOCX(zip+XML), HWP 5(OLE+레코드), PDF(unpdf) → 문단·표 블록 → 텍스트(표는 "칸 | 칸")
4. 섹션·평가 기준·제출 서류: LLM 1회 (`prompts/form-sections.v1.ts`). 입력 = 양식(사업계획서 > 계획서 > 신청서 순, 합쳐서 6만 자) + 공고문(3만 자)
   - 섹션을 못 찾거나 키가 없으면 기본 템플릿 `drafting/templates.ts` (창업패키지형 PSST / 바우처형 / R&D형, 공고명으로 고름)
   - 제출 서류는 `RequiredDoc`(createMany skipDuplicates → 사람이 바꾼 상태 유지). 문서 라이브러리 매칭은 아직
5. 섹션별 초안: 섹션마다 LLM 1회, 동시 3개 (`prompts/draft-section.v1.ts`). 시스템(규칙+회사+공고+평가 기준+전체 목차)은 캐시, 사용자 메시지에 섹션 제목·요령·분량
   - 규칙: 입력에 없는 사실·수치 금지 → `【확인 필요: 무엇】`. 과장어 금지. 분량을 10% 넘게 넘기면 한 번 줄여 달라고 다시
   - 출력 JSON `{ content, needsCheck[] }` → `needsCheck`는 본문에서 찾은 표시와 합친다(`lib/needsCheck.ts`)
   - 사람이 고치면 `generatedBy=human`, 확인 필요는 본문에서 다시 센다. 섹션별 다시 쓰기(다시/더 구체적으로/짧게/평가 기준 반영)
6. 15분 넘게 preparing·generating이면 멈춘 것으로 보고 다시 만들 수 있다
7. 아직 안 한 것: 원본 양식에 채워 내보내기(F4.6), 문서 라이브러리 검색(RAG)

### 6.1 보드·리뷰·내보내기 (M5)
- **상태 바꾸기는 한 곳**: `src/server/applications.ts`의 `transition()` — 전이 검사(`lib/transitions.ts`) → `setStatus()` → 부수 효과. 상태 버튼(`changeStatus`), 보드 드래그(`moveCard`, `expectFrom`으로 동시 변경 방지), "초안 만들기"가 모두 이걸 쓴다
  - `drafting`으로: 담당자가 비어 있으면 바꾼 사람, 초안이 없으면 `ensureDraft()` + `after(runDraft)`
  - `drafting → review`: `after(sendReviewRequest)` (Slack, 아래)
- 보드 `/board` (`server/board.ts`, `components/board/BoardView.tsx`): 추천됨(신규·검토) / 초안 작성 / 리뷰 / 제출 완료. HTML5 드래그 → 낙관적 이동, 서버가 거절하면 원위치 + 토스트. 드래그 못 하는 사람용으로 카드마다 "옮기기" 메뉴. 놓을 수 없는 열은 드래그 중 표시 안 함
- 리뷰 코멘트 `ReviewComment`(섹션 단위, 해결/다시 열기, 본인 것만 삭제). 리뷰어는 `Application.reviewers`, 초안 화면 오른쪽에서 지정
- 버전: 섹션마다 생성 시점 본문을 `DraftSection.aiContent`로 남겨 "AI 초안과 비교"(줄 단위 LCS, `lib/diff.ts`). 초안 전체 버전은 M4의 `Draft.version`(다시 만들면 새 버전)
- 내보내기 (`server/export/`): DOCX(`docx` 패키지, 맑은 고딕, `【확인 필요】`는 노란 형광, "- " 줄은 글머리), MD, PDF는 인쇄용 페이지 `/print/drafts/[id]` → 브라우저 "PDF로 저장"(서버에 Chromium 두지 않음). 확인 필요가 남아 있으면 메뉴에서 알려 준다

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
- **M3 반영**: 진행 중 = 초안 작성 중·리뷰 중. 구간마다 한 번(`DeadlineAlert @@unique([applicationId, bucket])`), 놓친 날은 다음 구간으로. 다이제스트 대상은 홈 "이번 주에 챙길 공고"와 같은 조건이고, 접수 시작 전이면 "12.19 마감 · 12.01 접수 시작". 발송 기록은 `Notification`(성공 시에만 `dedupeKey`). 링크는 원문 공고, 없으면 앱 상세(`APP_BASE_URL`). 리뷰 요청 알림(F6.3)은 M5에서: 리뷰 중으로 바뀔 때 1회, 리뷰어·섹션 수·확인 필요 개수와 초안 화면 링크 (`Notification.kind=review`)

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

- `ANTHROPIC_API_KEY`·`SLACK_WEBHOOK_URL`·`BIZINFO_API_KEY`·`DATA_GO_KR_SERVICE_KEY`는 화면(회사 프로필 → 연결 키)에서도 넣을 수 있다. DB `AppSecret`에 `AUTH_SECRET`에서 만든 키로 AES-256-GCM 암호화해 두고, `.env` 값이 있으면 그쪽이 먼저다 (`src/server/secrets.ts`)

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAIL_DOMAIN=
BIZINFO_API_KEY=
DATA_GO_KR_SERVICE_KEY=
ANTHROPIC_API_KEY=
LLM_MODEL_EXTRACT=
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
