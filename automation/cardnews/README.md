# SRC Plus 카드뉴스 자동화

기존 `reports_*.html` 리포트 게시 흐름은 유지하고, 게시된 최종 HTML을 Telegram에서 선택해 SRC Plus 카드뉴스 PPTX와 PNG ZIP을 생성한다. 개인 컴퓨터가 꺼져 있어도 Cloudflare Worker와 GitHub Actions에서 실행된다.

Cloudflare Workers AI 한도를 파이프라인의 전제조건으로 두지 않는다. 외부 provider와 GitHub Actions 실행기로 옮기는 단계별 설계는 [`evaluation/pipeline-redesign-no-cloudflare-ai-2026-08-15.md`](evaluation/pipeline-redesign-no-cloudflare-ai-2026-08-15.md)에 기록되어 있다.

완전 무료·provider 사용량 제한 없는 실행을 위해 PC가 켜져 있을 때 Ollama와 ComfyUI를 사용하는 로컬 실행 경로를 준비하고 있다. 하드웨어 사전 점검, 고정 모델 프로필과 실행 구조는 [`local/README.md`](local/README.md)에 있다. 현재 배포본은 아직 로컬 실행기로 전환되지 않았다.

2026-08-17 실제 PC에서 Qwen 로컬 경로와 OpenCodex Luna 품질 경로를 비교한 결과는 [`evaluation/local-model-first-run-2026-08-17.md`](evaluation/local-model-first-run-2026-08-17.md)에 기록했다.

## ChatGPT 반자동 고품질 흐름

API 이미지 비용 대신 기존 ChatGPT 사용 범위 안에서 문안과 이미지를 만들 때는 Git → Telegram → ChatGPT → Telegram → PPTX 흐름을 사용한다.

1. `main`에 `published=true`인 `reports_*.html`을 새로 추가하거나 수정하면 GitHub Actions가 Telegram에 알린다.
2. 새 등록 알림이 없어도 Telegram의 `/new`로 현재 `main`의 모든 `published=true` HTML 가운데 하나를 선택할 수 있다. 수정본과 보류 후 발행본도 같은 목록에 나타난다.
3. Telegram에서 `ChatGPT 작업 패킷 준비`를 누르거나 `/new`에서 특정 리포트를 고르면 Worker가 Git 원본 HTML과 `editorial.json`, 작업 안내 파일을 보낸다.
4. [chatgpt/CUSTOM_GPT_SETUP.md](chatgpt/CUSTOM_GPT_SETUP.md)를 따라 전용 Custom GPT에 GitHub read-only Action을 연결한다. GPT는 현재 GitHub `main`의 리포트 파일에서 `published=true` HTML만 골라, 사용자가 선택한 원문을 직접 불러온다.
5. ChatGPT가 반환한 최종 JSON을 파일로 저장해 Telegram에 첨부한다. Worker가 문안·프롬프트 규칙을 검증한다.
6. ChatGPT에서 검토·승인한 이미지를 Telegram 요청 순서대로 한 장씩 보낸다.
7. 모든 승인 이미지가 도착하면 기존 GitHub Actions가 PPTX와 PNG ZIP을 만들고 Telegram에 전송한다.

이 경로는 Custom GPT를 Git 이벤트로 무인 호출하지 않는다. Git·Telegram은 새 리포트 알림과 상태 관리를 자동화하고, GPT는 read-only Action으로 사용자가 선택한 발행 원문을 직접 읽는다. ChatGPT에서의 문안·이미지 생성과 최종 이미지는 사람이 검토한다. 새 Git 알림 workflow는 `CARDNEWS_WORKER_BASE_URL`, `CARDNEWS_CALLBACK_HMAC_SECRET` 두 기존 Secret을 사용한다.

## 반영된 운영 규칙

문구의 단일 기준은 `config/editorial.json`이다. Worker의 최초 생성·수정·전체 재생성, HTML 구조화 파서, PPT 렌더 직전 검증이 모두 이 파일을 읽는다. 글자 수나 문체를 바꿀 때는 다른 프롬프트를 직접 수정하지 않고 이 파일만 변경한다.

문구·이미지·비전 QA는 provider adapter를 통해 실행한다. `FREE_ONLY_MODE=true`가 유료·종량제 AI provider 호출을 차단한다. 무료 기본값은 AI Horde 텍스트와 Pollinations AI 이미지 생성, 자동 비전 QA 비활성화다. 따라서 Cloudflare Workers AI의 계정 전체 일일 Neurons 한도와 OpenAI API 비용을 사용하지 않는다. Pollinations의 현재 공식 `gen` endpoint는 API key를 요구하므로 무료 전용 모드에서는 키가 설정되어 있어도 사용하지 않고, 현재 동작이 확인된 legacy 이미지 endpoint를 3:4에 가까운 512×704로 먼저 시도한다. endpoint가 제한되면 공식 무료 서비스인 AI Horde 이미지 worker로 자동 fallback한다. 두 경로 모두 대기열·네트워크 시간 초과 시 작업을 보존한 채 `/retry`로 이어간다. 문안 생성과 이미지 계획 생성을 별도 Queue 단계로 분리하고, 한 번의 Queue 실행에서는 시간 초과를 막기 위해 최대 2회의 교정을 수행한 뒤 실패를 Queue에 돌려보낸다. Queue 전체는 중앙 규칙을 통과할 때까지 최대 10회 전달을 허용하고 그 뒤에만 사용자에게 실패로 알린다.

- 저장소 루트의 `reports_*.html`만 탐색
- `_PREVIEW` 파일 제외
- `report-meta.published === true` 파일만 표시
- 표지 1장 + 본문 3~5장 + 고정 안내 페이지 1장
- 모든 사용자 노출 문구는 한국어 중심, `~이다/~한다` 단문 서술체
- 표지 제목 36자 이하, 표지 부제 12~55자, 본문 제목 6~36자
- 본문은 페이지당 1~3문장, 70~220자
- 표지·부제·본문 1을 반복하지 않고 본문마다 배경·근거·변화·시사점·판단 기준 중 서로 다른 역할 부여
- 중앙 설정의 좋은/나쁜 예시는 형식과 톤에만 사용하며 예시의 주제·사실·표현은 복사하지 않음
- 공식 약어와 업계에서 일반적으로 쓰는 영어 표현만 유지
- 마지막 안내 페이지 문구는 `cta_subject` 한 구절을 제외하고 고정
- 마지막 안내 페이지는 직전 본문 페이지와 같은 이미지를 재사용
- 이미지는 사실적 편집 사진을 기본으로 하고, 개념 표현에만 자연스러운 일러스트 사용
- 이미지 프롬프트에서 기업명·로고·간판·텍스트·숫자·워터마크를 금지
- 비전 QA는 advisory 모드이며, 최종 선택은 Telegram에서 사람이 수행
- 실패 작업은 `/retry`로 이어서 실행할 수 있고, 실패 뒤 보내는 자연어 수정 요청도 가장 최근 작업의 문안·이미지 계획 재작성으로 연결
- Instagram 자동 게시는 포함하지 않음

## 구조

```text
GitHub reports_*.html
        ↓ repository_dispatch
GitHub Actions: 구조화 파싱
        ↓ R2 + HMAC callback
Cloudflare Worker
  ├─ D1 상태 머신
  ├─ 무료 AI provider adapter (AI Horde + Pollinations)
  ├─ R2 중간·최종 파일
  └─ Telegram 승인 UI
        ↓ repository_dispatch
GitHub Actions: PPTX 조립 + LibreOffice PNG 렌더
        ↓
Telegram: PPTX + PNG ZIP
```

## 최초 한 번 필요한 계정 작업

이 저장소 코드만으로 BotFather의 봇 생성이나 Cloudflare 계정 권한 부여를 대신할 수는 없다. 토큰은 채팅에 붙이지 말고 GitHub Actions Secrets와 Cloudflare Worker Secrets에만 저장한다.

### 1. Telegram BotFather

1. Telegram에서 `@BotFather` → `/newbot`
2. 생성된 토큰을 GitHub Secret `TELEGRAM_BOT_TOKEN`으로 저장
3. 긴 난수를 두 개 만들어 `TELEGRAM_WEBHOOK_SECRET`, `CARDNEWS_SETUP_TOKEN`으로 저장
4. 배포 후 봇과의 개인 채팅에서 `/claim CARDNEWS_SETUP_TOKEN값`을 한 번 실행
5. 이후에는 `/new`, `/jobs`를 사용

`/claim`을 사용하므로 chat ID를 별도로 조회할 필요가 없다. `ALLOWED_CHAT_ID`를 Wrangler 변수에 직접 설정하면 `/claim`보다 우선한다.

### 2. Cloudflare 리소스

Cloudflare 대시보드 또는 Wrangler에서 다음 이름으로 생성한다.

```bash
npx wrangler d1 create cardnews-db
npx wrangler r2 bucket create cardnews-assets
npx wrangler queues create cardnews-jobs
npx wrangler queues create cardnews-jobs-dlq
```

D1 생성 결과의 ID를 GitHub Secret `CLOUDFLARE_D1_DATABASE_ID`에 저장한다.

R2 → Manage R2 API Tokens에서 `cardnews-assets` 버킷에 대한 Object Read & Write 토큰을 만들고 다음 Secrets를 저장한다.

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### 3. Cloudflare API Token

Cloudflare 계정에만 범위를 제한한 API Token을 생성한다. Worker 배포, D1, R2, Queues를 관리할 수 있는 최소 권한만 준다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CARDNEWS_WORKER_BASE_URL` 예: `https://srcplus-cardnews.<subdomain>.workers.dev`

### 4. GitHub fine-grained PAT

Worker가 `repository_dispatch`를 호출할 수 있도록 `bay-top/SRC_Plus` 한 저장소에만 제한한 fine-grained PAT를 만든다.

- Repository permissions → Contents: Read and write
- Metadata: Read
- Secret 이름: `CARDNEWS_GITHUB_PAT`

추가로 임의의 긴 난수를 `CARDNEWS_CALLBACK_HMAC_SECRET`에 저장한다.

## GitHub Actions Secrets 전체 목록

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
CARDNEWS_SETUP_TOKEN
CARDNEWS_GITHUB_PAT
CARDNEWS_CALLBACK_HMAC_SECRET
CARDNEWS_WORKER_BASE_URL
OPENAI_API_KEY (선택 provider용)
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

## 배포

1. PR을 병합한다.
2. Actions → `Deploy SRC Plus cardnews Worker` → Run workflow
3. D1 migration, Worker 배포, Worker secret 등록, Telegram webhook 등록, health check가 순서대로 실행된다.
4. Telegram에서 `/claim ...` 후 `/new`로 테스트한다.

배포 워크플로는 `.github/workflows/cardnews-cloudflare-deploy.yml`에 있다. 수동 실행만 허용하며 Node.js 22에서 Wrangler 설정 생성과 타입 검사를 마친 뒤 D1 migration, Worker 배포, Telegram webhook 등록, health check를 수행한다.

### AI provider 전환

무료 기본 경로는 별도 provider secret 없이 AI Horde 익명 텍스트 생성과 Pollinations AI 이미지 생성을 사용한다. Pollinations 이미지 endpoint가 401·429·일시 오류를 반환하면 AI Horde 이미지 worker로 자동 fallback한다. AI Horde는 커뮤니티 worker 대기열이므로 텍스트는 90초, 이미지는 150초 안에 응답하지 않으면 작업을 보존한 채 실패시키고 `/retry`로 재시도한다. 무료 전용 모드에서는 `POLLINATIONS_API_KEY`와 `OPENAI_API_KEY`가 존재해도 유료 endpoint를 호출하지 않는다. Pollinations legacy endpoint는 공급자 정책 변경에 따라 제한될 수 있으므로 AI Horde fallback을 제거하지 않는다. 유료 provider 전환은 `FREE_ONLY_MODE=false`를 명시적으로 설정해야만 가능하다.

이 무료 모드에서 Cloudflare는 아직 Telegram webhook·D1·R2를 제공하는 호스팅으로만 남아 있고 AI 호출에는 사용되지 않는다. 호스팅까지 완전히 제거하려면 별도 무료 호스팅과 데이터베이스를 선택한 뒤 2단계 이전 문서를 따른다.

## GitHub Actions 파이프라인

`.github/workflows/cardnews.yml`은 Worker가 보내는 `repository_dispatch`의 `cardnews_job` 이벤트를 처리한다.

- `action: parse`: `reports_*.html` 경로를 검증하고 구조화 JSON을 R2에 저장한 뒤 `SOURCE_PARSED` callback을 보낸다.
- `action: render`: render manifest와 이미지를 R2에서 받아 PPTX와 PNG ZIP을 만들고 `RENDERED` callback을 보낸다.
- 두 job 모두 실패하면 실행 URL을 포함한 `FAILED` callback을 보낸다.
- 같은 job과 action 조합은 concurrency group으로 묶되 실행 중인 작업을 자동 취소하지 않는다.

## 로컬 검증

Node.js 의존성과 Wrangler 설정을 준비한 뒤 타입 검사를 실행한다.

```bash
cd automation/cardnews
npm install
npm run generate:config
npm run typecheck
python -m unittest discover -s pipeline -p "test_*.py"
```

`wrangler.generated.jsonc`, `.dev.vars`, `node_modules`, Wrangler 상태 파일과 Python 캐시는 `automation/cardnews/.gitignore`에서 제외한다. 실제 비밀값은 생성된 설정 파일이나 커밋에 넣지 않는다.

## 이미지 QA

`VISION_QA_MODE` 기본값은 `advisory`다. 이미지 생성 후 다음 항목을 검사하고 A/B 후보 캡션에 표시한다.

- 읽을 수 있는 글자·숫자·간판
- 로고·브랜드·워터마크
- 명백한 AI 왜곡
- 하단 텍스트 영역 적합성

Cloudflare의 `@cf/meta/llama-3.2-11b-vision-instruct`는 최초 사용 전에 Meta 라이선스 동의 요청이 필요할 수 있다. QA 호출이 실패해도 이미지 생성과 사람 검수는 계속 진행된다. QA를 끄려면 `VISION_QA_MODE`를 `off`로 변경한다.

## PPT 디자인

`pipeline/build_deck.py`는 제공된 `Asset light_cardnews-rev.pptx`를 분석해 다음을 재현한다.

- 5.625 × 7.5인치, 3:4
- 표지 40pt, 본문 제목 28pt, 본문 12pt, CTA 14pt
- 좌우 0.3937인치 여백
- 상단 SRC Plus와 카테고리
- 검은 상·하단 그라데이션
- 마지막 안내 페이지 전체 암막
- 마지막 본문 이미지 재사용

PPT 생성 전 `pipeline/editorial_rules.py`가 `config/editorial.json`을 다시 읽어 페이지 수, 글자 수, 문장 수, 표지·본문 제목 중복을 검사한다. 기준을 벗어난 manifest는 넘치는 텍스트를 억지로 렌더링하지 않고 작업을 실패시켜 검토 대상으로 남긴다.

GitHub runner에는 Pretendard가 기본 설치되지 않으므로 현재 자동 렌더링은 `Noto Sans CJK KR`을 사용한다. 추가 PPT 3~5개의 반복 규칙이 확인되면 위치·문장 길이·카테고리 단복수 표기를 `config/design.json`에서 보정한다.

## 상태 머신

```text
SELECTED → PARSING → SOURCE_PARSED
→ COPY_DRAFTING → COPY_DRAFTED → COPY_APPROVED
→ PROMPT_DRAFTING → PROMPT_DRAFTED → IMAGE_GENERATING → IMAGES_GENERATED
→ RENDERING → RENDERED → FINAL_APPROVED
```

## 보안

- Telegram webhook `secret_token` 검증
- Queue 단계별 상태(`COPY_DRAFTING`, `PROMPT_DRAFTING`, `IMAGE_GENERATING`)와 실패 원인을 Telegram에 즉시 알림
- `/claim` 1회 관리자 등록 또는 고정 chat ID 허용목록
- GitHub PAT 저장소 범위 제한
- GitHub Actions callback HMAC-SHA256 검증
- Telegram update와 callback idempotency
- Queue 전체 최대 10회 재시도(한 번의 실행은 최대 2회 교정)
- `_PREVIEW` 및 비공개 리포트 제외
- 최종 파일 부분 전송 재개
