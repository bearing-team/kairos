# 배포 (AWS: Amplify Hosting + ECS Fargate, DB는 Neon)

## 구성

| 리소스 | 하는 일 | 설정 |
| --- | --- | --- |
| Amplify Hosting | Next.js 화면·API (서버리스 컴퓨트) | `amplify.yml`, `scripts/amplify-bundle.mjs` |
| ECS Fargate `kairos-worker` | pg-boss 워커 1개: 일정 작업(소싱·점수·Slack) + 웹이 맡긴 응답 뒤 작업(초안·점수·게시판 확인·리뷰 요청) | `infra/aws/kairos.yml`, `Dockerfile.worker` |
| S3 버킷 | 공고 첨부·양식 파일 (`attachments/`) | `infra/aws/kairos.yml` |
| Neon Postgres | DB | 콘솔에서 만든다 |
| GitHub Actions `worker` | main 푸시 → 워커 이미지 ECR → 서비스 재배포 | `.github/workflows/worker.yml` |

왜 이렇게 나눴나:
- Amplify의 Next.js 자동 지원은 15까지다. Next 16은 **배포 명세**(`.amplify-hosting/deploy-manifest.json`)로 standalone 서버를 일반 Node 컴퓨트(nodejs22.x, 포트 3000)에 올린다. 컴퓨트 묶음 220MB 제한, 실행 최대 15분, 쓸 수 있는 디스크는 `/tmp`(512MB)뿐
- 서버리스라 응답 뒤 작업(`after()`)이 보장되지 않고 계속 떠 있는 프로세스도 없다 → `BACKGROUND_JOBS=queue`로 pg-boss 큐에 넣고 Fargate 워커가 처리. 디스크가 남지 않으니 파일은 S3
- 비용 감: Fargate 0.5 vCPU/1GB 1개 상시 + 공인 IPv4 ≈ 월 $25 (ap-northeast-2), Amplify는 빌드 시간·요청량 기준(내부 툴이면 몇 달러)

## 처음 한 번

리전은 서울(`ap-northeast-2`) 기준. AWS CLI가 대상 계정으로 로그인돼 있어야 한다.

### 1. Neon

1. 프로젝트를 만들고(리전 AWS ap-northeast-2 권장) 연결 문자열 두 개를 복사한다
   - 풀러 주소(`-pooler`가 붙은 호스트) → `DATABASE_URL`
   - 직접 주소 → `DATABASE_URL_UNPOOLED`

### 2. 비밀값을 SSM에 (워커용)

`AUTH_SECRET`은 `openssl rand -base64 32`. **한 번 정하면 바꾸지 않는다** (화면에서 넣은 연결 키가 이 값으로 암호화됨). 웹(Amplify)에도 같은 값을 넣는다.

```bash
aws ssm put-parameter --name /kairos/DATABASE_URL --type SecureString --value '<풀러 주소>'
```
```bash
aws ssm put-parameter --name /kairos/DATABASE_URL_UNPOOLED --type SecureString --value '<직접 주소>'
```
```bash
aws ssm put-parameter --name /kairos/AUTH_SECRET --type SecureString --value '<AUTH_SECRET>'
```

### 3. AWS 리소스 (CloudFormation)

기본 VPC의 퍼블릭 서브넷이면 충분하다 (워커는 들어오는 연결 없이 공인 IP로 나가기만 함). 처음엔 `WorkerDesiredCount=0`(이미지가 아직 없음).

```bash
aws cloudformation deploy --stack-name kairos --template-file infra/aws/kairos.yml --capabilities CAPABILITY_IAM --parameter-overrides VpcId=<vpc-id> SubnetIds=<subnet-a>,<subnet-b> WorkerDesiredCount=0
```
```bash
aws cloudformation describe-stacks --stack-name kairos --query "Stacks[0].Outputs" --output table
```

출력: `FilesBucketName`, `AmplifyComputeRoleArn`, `WorkerRepositoryUri`, `GitHubDeployRoleArn`.
계정에 GitHub OIDC 공급자가 이미 있으면 `CreateGitHubOidcProvider=false`를 같이 넘긴다.

### 4. Amplify 앱

1. Amplify 콘솔 → 새 앱 → GitHub `bearing-team/kairos`, 브랜치 `main`. 빌드 설정은 저장소의 `amplify.yml`을 그대로 쓴다
2. **앱 설정 → IAM roles → Compute role**에 `AmplifyComputeRoleArn` 역할을 고른다 (S3 접근)
3. **환경 변수** (빌드 때 `server-env.json`으로 묶여 런타임에 들어간다. 목록은 `scripts/amplify-bundle.mjs`의 `RUNTIME_ENV`)

   | 이름 | 값 |
   | --- | --- |
   | `DATABASE_URL` | Neon 풀러 주소 |
   | `DATABASE_URL_UNPOOLED` | Neon 직접 주소 (빌드 때 마이그레이션에만 쓰고 묶지 않음) |
   | `AUTH_SECRET` | 2번과 같은 값 |
   | `BACKGROUND_JOBS` | `queue` |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_BUCKET` | `FilesBucketName` |
   | `S3_REGION` | `ap-northeast-2` |
   | `APP_BASE_URL` | Amplify 도메인 (예 `https://main.xxxx.amplifyapp.com`) — 첫 배포 뒤 알 수 있으니 그때 넣고 다시 배포 |

   Amplify는 `AWS_`로 시작하는 이름을 못 쓰게 해서 `S3_REGION`을 따로 둔다.
4. **접근 제어(Access control)를 켠다.** 지금은 앱에 로그인이 없어서 주소만 알면 누구나 들어온다. 앱 설정 → Access control → 브랜치 `main`에 사용자 이름·비밀번호를 걸고 팀에만 공유한다
5. 배포가 끝나면 도메인으로 들어가 본다 (`/api/health` → `{"ok":true}`)

빌드에서 하는 일: Node 22 → `pnpm install`(hoisted) → `pnpm db:deploy`(마이그레이션 + 회사가 없을 때만 시드) → `NEXT_OUTPUT=standalone pnpm build` → `node scripts/amplify-bundle.mjs`.

### 5. 워커 이미지 올리고 켜기

GitHub 저장소 Settings → Secrets and variables → Actions → **Variables**:
- `AWS_REGION` = `ap-northeast-2`
- `AWS_WORKER_DEPLOY_ROLE_ARN` = `GitHubDeployRoleArn`

Actions 탭에서 `worker` 워크플로를 한 번 수동 실행(workflow_dispatch)해 이미지를 올린 뒤, 서비스를 1개로 켠다.

```bash
aws cloudformation deploy --stack-name kairos --template-file infra/aws/kairos.yml --capabilities CAPABILITY_IAM --parameter-overrides WorkerDesiredCount=1 AppBaseUrl=https://main.xxxx.amplifyapp.com
```

`VpcId`·`SubnetIds`는 앞서 넣은 값이 유지된다 (`--parameter-overrides`에 없으면 이전 값).

로그에 `워커 시작: …`이 보이면 된다.

```bash
aws logs tail /kairos/worker --follow
```

## 넣지 않는 것

- `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`, `BIZINFO_API_KEY`, `DATA_GO_KR_SERVICE_KEY` — 앱의 회사 프로필 → "연결 키"에서 넣는다 (DB에 암호화, 웹·워커가 같이 읽음). 환경 변수로 넣어도 되고 그러면 그쪽이 먼저. Amplify에 넣으면 웹 묶음에 들어가고, 워커에는 따로 넣어야 하니 화면으로 넣는 쪽이 간단하다
- `STORAGE_DIR`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — 역할로 접근한다

## 이후

- `main`에 푸시하면 Amplify가 웹을, GitHub Actions가 워커를 다시 배포한다. 마이그레이션은 Amplify 빌드에서 돈다 (워커가 먼저 뜨면 잠깐 옛 스키마를 볼 수 있다. 스키마를 크게 바꿀 땐 웹 배포가 끝난 뒤 워커 워크플로를 다시 돌린다)
- Amplify 환경 변수를 바꾸면 **다시 배포해야** 반영된다 (빌드 때 묶임)
- 런타임에 쓰는 환경 변수를 새로 만들면 `scripts/amplify-bundle.mjs`의 `RUNTIME_ENV`와 `infra/aws/kairos.yml`의 작업 정의에도 추가
- 컴퓨트 묶음 크기는 빌드 로그의 `Amplify 묶음 완료` 줄 근처에서 확인 (220MB 제한, 지금 약 55MB)

## 주의

- Amplify 환경 변수는 배포 묶음(`server-env.json`)에 평문으로 들어간다 (AWS 문서도 비밀값은 권하지 않음). 이 묶음은 이 AWS 계정의 Amplify 권한이 있는 사람만 볼 수 있다. 더 조이려면 SSR 컴퓨트 역할로 SSM을 읽게 바꾼다
- Amplify 공식 지원 밖(Next 16 + 배포 명세)이라 ISR·이미지 최적화·스트리밍은 쓰지 않는다. 지금 앱은 `next/image`를 안 쓰고, 화면은 요청마다 렌더링해서 문제없다. Suspense 스트리밍은 한 번에 내려온다
