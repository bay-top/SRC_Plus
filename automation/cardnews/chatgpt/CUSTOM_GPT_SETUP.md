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
- **Web Search: 끔** — 원문 밖의 사실을 임의로 보충하지 않게 함

### Action: GitHub 원문 직접 조회

1. **Actions**에서 **Create new action**을 선택한다.
2. `SRC_PLUS_GPT_ACTION.openapi.yaml`을 그대로 붙여 넣는다.
3. Authentication은 **None**으로 둔다. 공개 GitHub 원문만 읽으므로 키가 필요 없다.
4. Actions Test에서 `listGitHubReportFiles`와 `getGitHubReportHtml`을 각각 한 번 실행한다.

### Conversation starter

```text
현재 발행된 SRC Plus 리포트 목록을 보여줘. 내가 하나를 고르면 원문을 읽고 중앙 규칙에 맞는 카드뉴스 JSON만 만들어줘.
```

## 3. 첫 테스트

1. Custom GPT에서 발행 리포트 목록을 불러오고 하나를 선택한다. Telegram의 `/new` 선택도 같은 GitHub 목록을 사용한다.
2. GPT가 원문 HTML을 Action으로 직접 읽는다.
3. JSON 결과를 `cardnews.json` 파일로 저장한다.
4. Telegram에 `cardnews.json`을 첨부한다.
5. 봇이 검증을 통과시키면 GPT에서 페이지별 최종 이미지를 생성하고, 승인 이미지를 Telegram에 순서대로 보낸다.

## 4. 운영 원칙

- 새 HTML마다 GPT 대화는 새로 시작한다. GPT는 다른 대화의 기억을 자동으로 가져오지 않는다.
- 수정 요청은 같은 대화에서 이어서 한다.
- 생성 이미지에 보이는 텍스트·로고·워터마크가 있으면 지우지 않고 재생성한다.
- Telegram에는 선택이 끝난 원본 해상도 이미지만 보낸다.
