# 로컬 모델 첫 실행 검증 · 2026-08-17

## 환경

- PC: MSI Creator 17M A10SD
- GPU: GTX 1660 Ti Max-Q 6GB
- RAM: 15.8GB
- 외장 SSD: `D:\AI`
- Ollama: 0.32.13
- OpenCodex: 2.23.0
- 원문: `reports_insights_kb-balhae.html`

## 저장 구조

Ollama와 이미지 모델은 SRC Plus 저장소에 종속시키지 않는다.

```text
D:\AI\Models\Ollama
D:\AI\Models\StableDiffusion
D:\AI\Apps\ComfyUI
D:\AI\Projects\SRCPlus
```

## Qwen 로컬 경로

`qwen3.5:4b`는 짧은 4K JSON 호출에서 정상 작동했지만, 구형 NVIDIA 드라이버의 Vulkan 경로에서 긴 입력을 기본 1,024토큰 배치로 처리할 때 `Vulkan device lost`가 발생했다. `num_batch=256`으로 낮춘 뒤 8K 입력과 반복 호출이 안정화됐다.

문안 전용으로 더 가벼운 `qwen3:4b-instruct`를 시험했다. GPU 100%에서 약 44 output tokens/s를 기록했지만, 중앙 규칙 기반 10회 교정 뒤에도 특정 본문의 길이와 AI 상투어가 남았다. 현재 설정에서는 초안·저비용 fallback 용도로만 사용하고 자동 게시 문안의 기본 모델로 두지 않는다.

## OpenCodex Luna 경로

OpenCodex localhost gateway의 `gpt-5.6-luna`를 같은 입력과 중앙 규칙으로 실행했다.

- 문안: 3회에 통과
- 이미지 계획: 4회에 통과
- 표지 제목: `빠르게 오르는 시장, 느리게 버는 자산`
- 본문: 분배수익률 6.45%, 국고채 대비 235bp, 기준가격 대비 49.1%, Sharpe ratio 0.89를 서로 다른 페이지에 배치
- 이미지 대상: 유료도로 터널, 데이터센터, LNG 터미널, 데이터센터 증설 현장, 장거리 교량
- 이미지 프롬프트: 143·141·143·147·148단어

결과는 문안 글자 수·문장 수·중복·문체와 이미지 프롬프트의 단일 장면·카메라·렌즈·조명·하단 안전영역·글자와 로고 금지를 모두 통과했다.

OpenCodex 경로는 Ollama와 달리 현재 Codex 계정의 인증과 사용량 정책을 따른다. 완전 로컬 fallback과 품질 우선 경로를 같은 것으로 표시하지 않는다.

OpenCodex의 Ollama provider 등록과 Codex catalog 동기화는 완료됐다. Task Scheduler 기반 service 설치는 Windows에서 exit code 199로 실패했으나 CLI auto-start shim과 `start-local-ai.ps1`의 `opencodex ensure`를 통해 SRC Plus 실행 전에 gateway를 시작한다. Codex Desktop을 열기만 했을 때의 부팅 직후 자동 시작은 별도 과제로 남긴다.

## 검사기 수정

- 모델에 참고 제목 원문을 직접 주지 않아 예시 복사를 방지한다.
- 생성 스키마의 글자 수 상한으로 문장이 중간 절단되지 않게 하고 생성 후 중앙 검사에서 길이를 판정한다.
- 원문의 금지 비유는 의미가 같은 사실 표현으로 바꾼 근거본을 모델에 제공한다.
- Ollama GPU batch를 256으로 고정한다.
- 각 시도 JSON을 checkpoint로 보존하고 검증된 문안은 재실행 때 재사용한다.
- `photograph`의 `graph`, `Shoot` 촬영 지시, `No readable text, numbers, logos...`를 오인하던 이미지 프롬프트 검사를 수정한다.
- 이미지 프롬프트 분량을 110~150개 영어 단어로 강제한다.

## 다음 게이트

문안과 이미지 프롬프트 품질은 Luna 경로로 실제 이미지 모델 비교를 시작할 수 있는 수준이다. 이미지 자체는 Qwen이나 Luna가 아니라 ComfyUI의 별도 생성 모델이 담당한다. NVIDIA 드라이버 갱신 후 Realistic Vision SD 1.5와 SDXL 저메모리 프로필을 동일 프롬프트로 비교하고, 실제 SRC Plus 게시물 수준을 충족한 모델만 Telegram 생성 경로에 연결한다.
