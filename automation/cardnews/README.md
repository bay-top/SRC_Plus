# SRC Plus 카드뉴스 자동화

기존 `reports_*.html` 리포트 게시 흐름은 유지하고, 게시된 최종 HTML을 Telegram에서 선택해 SRC Plus 카드뉴스 PPTX와 PNG ZIP을 생성한다. 개인 컴퓨터가 꺼져 있어도 Cloudflare Worker와 GitHub Actions에서 실행된다.

## 반영된 운영 규칙

- 저장소 루트의 `reports_*.html`만 탐색
- `_PREVIEW` 파일 제외
- `report-meta.published === true` 파일만 표시
- 표지 1장 + 본문 3~5장 + 고정 안내 페이지 1장
- 모든 사용자 노출 문구는 한국어 중심, `~이다/~한다` 단문 서술체
- 공식 약어와 업계에서 일반적으로 쓰는 영어 표현만 유지
- 마지막 안내 페이지 문구는 `cta_subject` 한 구절을 제외하고 고정
- 마지막 안내 페이지는 직전 본문 페이지와 같은 이미지를 재사용
- 이미지는 사실적 편집 사진을 기본으로 하고, 개념 표현에만 자연스러운 일러스트 사용
- 이미지 프롬프트에서 기업명·로고·간판·텍스트·숫자·워터마크를 금지
- 비전 QA는 advisory 모드이며, 최종 선택은 Telegram에서 사람이 수행
- Instagram 자동 게시는 포함하지 않음

## 구조

```text
GitHub reports_*.html
        ↓ repository_dispatch
GitHub Actions: 구조화 파싱
        ↓ R2 + HMAC callback
Cloudflare Worker
  ├─ D1 상태 머신
  ├─ Workers AI 문구·이미지·선택적 비전 QA
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

Worker가 `repository_dispatch`를 호출할 수 있도록 `JBChoi-01/SRC_Plus` 한 저장소에만 제한한 fine-grained PAT를 만든다.

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
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

## 배포

1. PR을 병합한다.
2. Actions → `Deploy SRC Plus cardnews Worker` → Run workflow
3. D1 migration, Worker 배포, Worker secret 등록, Telegram webhook 등록, health check가 순서대로 실행된다.
4. Telegram에서 `/claim ...` 후 `/new`로 테스트한다.

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

GitHub runner에는 Pretendard가 기본 설치되지 않으므로 현재 자동 렌더링은 `Noto Sans CJK KR`을 사용한다. 추가 PPT 3~5개의 반복 규칙이 확인되면 위치·문장 길이·카테고리 단복수 표기를 `config/design.json`에서 보정한다.

## 상태 머신

```text
SELECTED → PARSING → SOURCE_PARSED
→ COPY_DRAFTING → COPY_DRAFTED → COPY_APPROVED
→ IMAGE_GENERATING → IMAGES_GENERATED
→ RENDERING → RENDERED → FINAL_APPROVED
```

## 보안

- Telegram webhook `secret_token` 검증
- `/claim` 1회 관리자 등록 또는 고정 chat ID 허용목록
- GitHub PAT 저장소 범위 제한
- GitHub Actions callback HMAC-SHA256 검증
- Telegram update와 callback idempotency
- Queue 3회 재시도
- `_PREVIEW` 및 비공개 리포트 제외
- 최종 파일 부분 전송 재개
