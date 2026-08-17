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

- 문안: Ollama `qwen3:4b-instruct`, JSON 출력, 8K context. 텍스트 전용 모델로 6GB VRAM에서 안정성을 우선한다.
- 선택적 이미지 검수: `qwen3.5:4b`. 이미지를 생성하지 않고 결과 이미지를 읽고 보조 평가할 때만 사용한다.
- 이미지: ComfyUI NVIDIA portable + Realistic Vision 계열 SD 1.5 checkpoint.
- 해상도: 512×704 생성 후 업스케일. 3:4에 가까운 세로 구도이며 기존 디자인에서 안전하게 crop한다.
- 후보: A/B를 동시에 만들지 않고 순차 생성해 VRAM 부족을 피한다.
- 최종 게이트: `config/editorial.json` 검증과 Telegram 사람 선택은 유지한다.
- SDXL은 기본값이 아니다. 기본 프로필을 통과한 뒤 품질 비교용으로만 시험한다.

Ollama는 SRC Plus 전용이 아니라 PC 전체의 공용 로컬 모델 서버다. 모델은 외장 SSD `D:\AI\Models\Ollama`에 한 번만 저장하고 SRC Plus, OpenCodex, 향후 OpenClaw·Hermes가 함께 사용한다. Stable Diffusion 모델도 `D:\AI\Models\StableDiffusion`에 공용으로 저장한다. OpenCodex는 에이전트용 공용 gateway이며, 카드뉴스 파이프라인은 장애 지점을 줄이기 위해 Ollama의 localhost API를 직접 호출한다.

## 현재 설치 차단 조건

`check-prerequisites.ps1`은 설치 전에 시스템 디스크, 외장 SSD, GPU, 드라이버, RAM을 따로 검사한다. 2026-08-17 현재 C: 여유 공간은 약 23GB, 외장 SSD D: 여유 공간은 약 877GB다. GTX 1660 Ti Max-Q 6GB와 RAM 15.8GB도 사용할 수 있다. NVIDIA 드라이버 456.79에서는 Ollama가 Vulkan으로 동작하므로 긴 문맥에서 안정성 검증이 필요하다.

1. C:에는 Windows, 드라이버와 임시 파일을 위해 최소 10GB를 남긴다.
2. 외장 SSD에는 공용 모델을 위해 최소 30GB, 권장 50GB 이상을 남긴다.
3. NVIDIA 드라이버를 최신 안정판으로 갱신하면 Vulkan 대신 CUDA 경로를 사용할 수 있어 안정성이 좋아진다.
4. PowerShell에서 다음을 실행한다.

```powershell
Set-Location 'C:\Side project\SRC+\work\SRC_Plus\automation\cardnews\local'
.\check-prerequisites.ps1
```

하드웨어 항목이 모두 `OK`가 된 뒤 Ollama와 ComfyUI를 설치한다. 모델 다운로드는 수 GB를 쓰므로 점검이 실패한 상태에서는 시작하지 않는다.

## 설정 파일

`config.example.json`을 `config.json`으로 복사해 사용한다. `runnerToken`은 이후 Worker에 저장할 동일한 비밀값이며 절대 커밋하지 않는다. 설치 후 `start-local-ai.ps1`이 두 로컬 API와 필요한 모델을 확인한다.

## 로컬 문안·이미지 프롬프트 검증

다음 명령은 실제 게시 HTML 하나를 구조화하고, 문안과 페이지별 이미지 프롬프트를 생성한 뒤 중앙 규칙을 통과할 때까지 단계마다 최대 10회 교정한다. 이미지 자체는 ComfyUI 설치 이후 별도 단계에서 생성한다.

```powershell
py -3 .\run_local_pipeline.py `
  --input '..\..\..\reports_insights_kb-balhae.html' `
  --output '.\output\kb-balhae-local.json'
```

출력 JSON에는 실제로 사용한 모델, 문안 교정 횟수와 이미지 계획 교정 횟수가 함께 기록된다.

OpenCodex의 현재 Codex 계정 모델과 품질을 비교할 때는 다음처럼 실행한다. 이 경로는 Ollama와 달리 현재 Codex 계정의 사용량 정책을 따른다.

```powershell
py -3 .\run_local_pipeline.py `
  --provider opencodex `
  --model gpt-5.6-luna `
  --input '..\..\..\reports_insights_kb-balhae.html' `
  --output '.\output\kb-balhae-luna.json'
```

## 다음 구현 단계

1. Worker에 인증된 `claim`, `heartbeat`, `complete`, `fail` endpoint와 lease 만료 처리를 추가한다.
2. 기존 `draft_copy`, `draft_visuals`, `generate_image` 작업을 외부 무료 provider 대신 로컬 작업 테이블에 넣는다.
3. Windows 실행기가 outbound polling으로 작업을 받고 Ollama/ComfyUI를 호출한다.
4. 중앙 문안 규칙, 이미지 프롬프트 규칙, 최대 10회 교정, Telegram 자연어 수정 흐름을 그대로 재사용한다.
5. 실제 리포트 한 건으로 문안 → 이미지 A/B → 선택 → PPTX까지 end-to-end 검증한다.

이 구조가 완성되기 전까지 현재 AI Horde/Pollinations 경로는 자동으로 로컬 경로로 바뀌지 않는다.
