# SRC Plus Custom GPT 설정

## 1. GPT 만들기

웹에서 `https://chatgpt.com/gpts/editor`를 열고 **Create**를 선택한다. 이름은 `SRC Plus Cardnews Editor`로 설정하고, 공개 범위는 **Only me**로 둔다.

## 2. Configure 설정

### Instructions

`SRC_PLUS_GPT_INSTRUCTIONS.md` 전체를 Instructions에 붙여 넣는다.

### Knowledge

아래 5개 파일을 그대로 업로드한다.

1. `../config/editorial.json`
2. `../evaluation/external-reference-and-image-output-2026-08-12.md`
3. `../evaluation/people-and-space-rules-2026-08-12.md`
4. `../evaluation/gpt-image-30-loop-2026-08-12.md`
5. `../evaluation/copy-review-kb-balhae-2026-08-12.md`

### Capabilities

- **Image Generation: 켬**
- **Code Interpreter & Data Analysis: 켬** — HTML과 JSON 파일을 읽고 저장하기 위해 사용
- **Web Search: 끔** — 업로드 HTML 밖의 사실을 임의로 보충하지 않게 함
- Actions와 Apps는 설정하지 않음

### Conversation starter

```text
Telegram에서 받은 HTML과 editorial.json을 업로드했다. 중앙 규칙에 맞는 카드뉴스 JSON만 만들어줘.
```

## 3. 첫 테스트

1. Telegram의 `/new`에서 HTML을 하나 선택한다.
2. 받은 HTML과 `editorial.json`을 GPT에 업로드한다.
3. JSON 결과를 `cardnews.json` 파일로 저장한다.
4. Telegram에 `cardnews.json`을 첨부한다.
5. 봇이 검증을 통과시키면 GPT에서 페이지별 최종 이미지를 생성하고, 승인 이미지를 Telegram에 순서대로 보낸다.

## 4. 운영 원칙

- 새 HTML마다 GPT 대화는 새로 시작한다. GPT는 다른 대화의 기억을 자동으로 가져오지 않는다.
- 수정 요청은 같은 대화에서 이어서 한다.
- 생성 이미지에 보이는 텍스트·로고·워터마크가 있으면 지우지 않고 재생성한다.
- Telegram에는 선택이 끝난 원본 해상도 이미지만 보낸다.
