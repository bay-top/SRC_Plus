# 로컬 AI 실행 준비

## 결정한 구조

```text
Telegram → 기존 Worker의 상태·승인 UI
                    ↓ 작업 보관
Windows 로컬 실행기 ── 주기적으로 가져오기(외부로 나가는 HTTPS만 사용)
       ├─ Ollama · 문안과 이미지 프롬프트
       └─ ComfyUI · 페이지별 A/B 이미지 순차 생성
                    ↓ 결과 업로드
            기존 Telegram 검수·PPT 렌더
```

PC의 포트를 인터넷에 열거나 터널을 상시 운영하지 않는다. PC가 꺼져 있으면 Worker가 작업을 보관하고, 다시 켜진 실행기가 마지막 checkpoint부터 이어받는다. 로컬 모델 호출에는 일일 토큰·Neurons·요청 횟수 제한이 없지만 전기, 실행 시간, 저장 공간은 사용한다.

## 이 PC용 고정 프로필

- 문안: Ollama `qwen3.5:4b`, JSON 출력, 16K context. 6GB VRAM에서 먼저 검증한다.
- 이미지: ComfyUI NVIDIA portable + Realistic Vision 계열 SD 1.5 checkpoint.
- 해상도: 512×704 생성 후 업스케일. 3:4에 가까운 세로 구도이며 기존 디자인에서 안전하게 crop한다.
- 후보: A/B를 동시에 만들지 않고 순차 생성해 VRAM 부족을 피한다.
- 최종 게이트: `config/editorial.json` 검증과 Telegram 사람 선택은 유지한다.
- SDXL은 기본값이 아니다. 기본 프로필을 통과한 뒤 품질 비교용으로만 시험한다.

## 현재 설치 차단 조건

`check-prerequisites.ps1`은 설치 전에 디스크, GPU, 드라이버, RAM을 검사한다. 2026-08-16 점검에서는 GTX 1660 Ti Max-Q 6GB와 RAM 15.8GB는 사용할 수 있지만 C: 여유 공간이 약 3~4GB이고 NVIDIA 드라이버가 456.79라서 설치를 중지해야 한다.

1. C: 여유 공간을 최소 20GB, 권장 30GB로 확보한다.
2. NVIDIA 드라이버를 527.41 이상 최신 안정판으로 갱신하고 재부팅한다.
3. PowerShell에서 다음을 실행한다.

```powershell
Set-Location 'C:\Side project\SRC+\work\SRC_Plus\automation\cardnews\local'
.\check-prerequisites.ps1
```

하드웨어 항목이 모두 `OK`가 된 뒤 Ollama와 ComfyUI를 설치한다. 모델 다운로드는 수 GB를 쓰므로 점검이 실패한 상태에서는 시작하지 않는다.

## 설정 파일

`config.example.json`을 `config.json`으로 복사해 사용한다. `runnerToken`은 이후 Worker에 저장할 동일한 비밀값이며 절대 커밋하지 않는다. 설치 후 `start-local-ai.ps1`이 두 로컬 API와 필요한 모델을 확인한다.

## 다음 구현 단계

1. Worker에 인증된 `claim`, `heartbeat`, `complete`, `fail` endpoint와 lease 만료 처리를 추가한다.
2. 기존 `draft_copy`, `draft_visuals`, `generate_image` 작업을 외부 무료 provider 대신 로컬 작업 테이블에 넣는다.
3. Windows 실행기가 outbound polling으로 작업을 받고 Ollama/ComfyUI를 호출한다.
4. 중앙 문안 규칙, 이미지 프롬프트 규칙, 최대 10회 교정, Telegram 자연어 수정 흐름을 그대로 재사용한다.
5. 실제 리포트 한 건으로 문안 → 이미지 A/B → 선택 → PPTX까지 end-to-end 검증한다.

이 구조가 완성되기 전까지 현재 AI Horde/Pollinations 경로는 자동으로 로컬 경로로 바뀌지 않는다.
