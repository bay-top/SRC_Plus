# SRC Plus 카드뉴스 파이프라인 재설계안 · 2026-08-15

## 결론

Cloudflare Workers AI를 카드뉴스 생성 경로에서 제거한다. Cloudflare의 계정 전체 무료 Neurons 한도가 문안 교정, 이미지 계획, 이미지 생성, 비전 QA를 함께 막는 현재 구조는 운영 기준에 맞지 않는다. `FREE_ONLY_MODE=true`로 유료·종량제 provider 호출을 차단하고, 무료 실행 경로는 AI Horde 텍스트와 Pollinations AI 이미지를 사용하며 이미지 endpoint 제한 시 AI Horde 이미지 worker로 fallback한다.

1단계에서는 기존 Worker를 Telegram·승인·상태 전달용 얇은 오케스트레이터로만 남기고, AI 실행은 GitHub Actions의 단일 장시간 작업으로 이동한다. 2단계에서는 새 호스팅과 데이터베이스 인증이 준비되면 webhook·상태 저장까지 Worker 밖으로 옮긴다.

## 목표 구조

```text
Telegram
  ↓ webhook / approval
Orchestrator (1단계: 기존 Worker, 2단계: 새 serverless host)
  ├─ 상태·checkpoint 저장
  ├─ GitHub Actions dispatch
  └─ 사용자 진행 메시지
        ↓
GitHub Actions cardnews-run
  ├─ HTML 파싱·원문 근거 추출
  ├─ 외부 text provider 문안 생성·검증·교정
  ├─ 외부 image provider 또는 stock-first 검색
  ├─ 후보 A/B·비전 QA
  ├─ 중앙 규칙 검증
  └─ PPTX·PNG 렌더 및 callback
```

## AI provider 원칙

- Worker 코드에서 `env.AI.run`을 카드뉴스 생성의 필수 경로로 사용하지 않는다.
- text, image, vision을 서로 다른 provider로 바꿀 수 있는 adapter 계약을 사용한다.
- provider 호출 결과와 비용·잔여량·HTTP 오류를 job checkpoint에 기록한다.
- quota/rate-limit 오류는 즉시 중지하고 마지막 성공 checkpoint를 보존한다. 같은 작업을 무한 재시도하지 않는다.
- provider 인증은 GitHub Actions Secrets에만 둔다. 채팅, HTML, 커밋에는 절대 기록하지 않는다.

## 이미지 전략

1. 페이지 주장과 원문 자산을 추출한다.
2. Pollinations AI 이미지 endpoint에서 3:4에 가까운 512×704 이하 이미지를 먼저 생성하고, 요청 제한·일시 오류 때 AI Horde 이미지 worker에서 8단계 샘플링으로 fallback한다.
3. 두 경로의 대기열·네트워크 시간이 제한시간을 넘으면 이미지 후보를 저장하지 않고 `/retry`로 재시도한다.
4. 생성 결과는 동일한 사람 검수·중앙 이미지 규칙을 통과시킨다.
5. 사람은 공간을 설명하는 보조 요소로만 허용하고, 로고·문자·간판·워터마크·얼굴 중심 구도는 탈락시킨다.

이 전략은 생성 모델 무료 할당량을 모든 카드에 소모하지 않으며, SRC Plus가 요구하는 실제 사진·Getty Images풍 톤에도 더 직접적으로 맞는다.

## 단계별 이전

### 1단계 · AI 실행 분리

- Worker는 `dispatch_ai_run`만 큐에 넣고 AI를 직접 호출하지 않는다.
- GitHub Actions가 `copy → visual_plan → image_candidates → render`를 한 run에서 수행한다.
- 각 단계 완료 시 R2와 callback에 checkpoint를 남긴다.
- `/retry`는 실패한 마지막 단계부터 해당 Actions run을 재실행한다.

### 2단계 · Cloudflare 완전 제거

- Telegram webhook을 Vercel/Render/Fly.io 중 하나로 이전한다.
- D1/R2를 Postgres-compatible DB와 object storage로 이전한다.
- 기존 Telegram callback 계약과 중앙 `editorial.json`은 유지한다.
- 새 호스팅과 provider secret이 확인되기 전에는 현재 Worker를 삭제하지 않는다.

## 선행 조건

무료 실행 경로는 별도 provider secret 없이 시작할 수 있다. 다만 AI Horde는 커뮤니티 대기열이고 Pollinations legacy endpoint는 지속 제공이 보장되지 않으므로, 중앙 규칙 검증과 사람 검수를 최종 게이트로 유지한다. 호스팅까지 Cloudflare 밖으로 옮기는 단계에는 별도 무료 호스팅·DB 인증이 필요하다.
