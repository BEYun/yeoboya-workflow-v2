---
name: yeoboya-publish-notion
description: "yeoboya-workflow에서 Notion 페이지 쓰기나 작업 DB row 변경에 필수다. 세부작업 스킬에서 `notion-create-pages`나 `notion-update-page`를 직접 호출하지 말 것 — 먼저 이 스킬을 호출한다. work DB row upsert(dispatch), 워크스페이스 인지 속성 설정을 처리하고, `notion-page-record` hook이 pageId를 work.json.links에 기록하는 데 필요한 페이지 제목을 노출한다. 세부작업 스킬(write-policy, write-domain, draw-ui-flow, draw-data-flow, write-qa)이 산출물을 게시해야 할 때, 또는 create-work이 작업 DB row를 등록/동기화해야 할 때 사용한다."
user-invocable: false
---

# yeoboya-publish-notion

Notion 쓰기의 단일 진입점. 모든 세부작업 스킬은 산출물을 publish할 때 본 skill을 통해 Notion에 쓴다.

## 1. 도구 호출 규약

- create 경로: `mcp__claude_ai_Notion__notion-create-pages`
- update 경로: `mcp__claude_ai_Notion__notion-update-page` (기존 pageId가 있을 때)
- **upsert 규칙**: `work.json.links[<key>]`(다중 페이지는 `links[<key>][<title>]`)가 있으면 update, 없으면 create. 이 판단은 **동기화된 links**를 전제로 한다 — 호출자(세부작업 스킬)는 진입 시 `mode="sync-links"`로 links를 먼저 최신화하므로, 다른 작업자가 만든 기존 페이지도 create가 아니라 update된다(중복 방지).

## 2. 페이지 제목 결정

title은 `hooks/lib/constants.json`의 `KEY_TO_TITLE[key]`에서 결정된다.

- 단일 페이지 키(write-policy, write-domain, draw-ui-flow, write-qa 등): 호출자가 `title`을 전달하지 않는다. publish-notion이 `KEY_TO_TITLE[key][0]`을 페이지 제목으로 사용.
- 다중 페이지 키(draw-data-flow): 호출자가 `title`을 전달한다. `KEY_TO_TITLE["draw-data-flow"]`의 값("데이터 흐름도" 또는 "통신 명세서") 중 하나여야 한다.

`KEY_TO_TITLE`에 없는 key+title 조합은 hook 기록 없이 Notion 페이지만 생성한다 (review-code 등 links 미기록 항목에서 활용).

## 3. 호출 형태

호출 시 다음 파라미터를 받는다:

- `work`: 작업번호 (e.g., "DCL-1234")
- `mode`: "dispatch" | "sync" | "sync-links"
  - `dispatch`: 세부 작업/키 산출물 페이지 create/update. payload: `key`, `title`, `markdown`, 옵션 `properties`.
  - `sync`: 작업 DB row 조회. create-work에서 도메인/담당자 추출용.
  - `sync-links`: 작업 row 자식 페이지를 나열해 work.json.links를 Notion 실제 상태로 동기화. payload: `work`만. (§5.5)

hook(`notion-page-record`)은 페이지 publish 시 `work.json.links`에 pageId를 기록한다. 상태 자동 갱신 기능은 제거되었으며 본 skill은 어떠한 select 필드도 자동 변경하지 않는다.

## 4. dispatch 흐름

1. `work`로 work.json 로드 → `links[<key>]` 또는 `links[<key>][title]` 확인
2. workspace.json 로드 → `notion.workDbDataSourceUrl`, `notion.workerPageId`, `notion.domainMapping`
3. 기존 페이지가 있으면 update-page (replace_content), 없으면 create-pages. response 결과 보존
4. 응답 반환 — page id

산출물 링크는 hook이 work.json.links에 자동 기록하므로 본 skill에서 별도 쓰기 안 함.

## 5. sync 흐름

1. workspace.json의 `notion.workDbDataSourceUrl`로 작업 DB query
2. `<work>` 키 매칭되는 row 조회
3. 반환: `{ rowId, workType, 작업명, 도메인, 담당자: string[], iOS_완료, Android_완료 }` (없는 필드는 null)

`담당자`는 URL 배열.

## 5.5 sync-links 흐름

1. `workspace.json`의 `notion.workDbDataSourceUrl`로 작업 DB에서 `<work>` row를 찾는다 (§5 sync의 row lookup과 동일).
2. 그 row의 **자식 페이지**를 Notion MCP로 나열하여 `[{ "title": ..., "id": ... }, ...]`를 수집한다 (notion-writer subagent의 list-children 책임).
3. 수집한 JSON 배열을 `node ${CLAUDE_PLUGIN_ROOT}/hooks/lib/sync-links.js <work>` 에 stdin으로 파이프한다.
4. 헬퍼가 제목→키 매칭(constants.json `TITLE_TO_KEY`, hook과 동일 함수)으로 `work.json.links`를 결정적으로 병합·기록하고, 해소된 links를 stdout(JSON)으로 반환한다.
5. 반환된 links를 호출자에게 전달한다.

제목 매칭·링크 쓰기는 전부 node 헬퍼가 수행한다 — 본 skill(LLM)은 Notion 자식 나열만 담당한다. 매칭 안 된 자식(unknown-title)은 무시되며 기존 links는 보존된다.

## 6. 호출자(create-work / 세부작업 스킬 / hook)에게 노출되는 인터페이스

```
yeoboya-publish-notion 호출 파라미터:
  work: "DCL-1234"
  mode: "dispatch" | "sync" | "sync-links"
  (dispatch만)
    key: "<세부 작업 키>"
    title?: "<draw-data-flow 호출 시만 필수. 다른 key는 생략>"
    markdown: "<페이지 본문>"
    properties?:
      workType?: <feature|update|bugfix>   # WORKTYPE_LABEL로 select 값 변환
      작업명?: string
      도메인?: string                      # 존재하는 select option만
      담당자?: { mode: "append", urls: string[] }   # 항상 append, replace 금지
      iOS_완료?: boolean
      Android_완료?: boolean
  (sync-links만)
    작업 row 자식 페이지를 work.json.links에 동기화 — work만 필요 (§5.5)
```

`담당자` payload는 항상 `mode: "append"` 형식이며 본 skill 내부에서 기존 relation list와 union 연산. 절대 replace하지 않는다.

ID↔URL 변환(예: `workspace.notion.workerPageId` → 페이지 URL)은 본 skill이 책임진다 — 호출자는 정규화된 worker pageId만 전달.

## 7. 에이전트 사용

본 skill은 `agents/notion-writer.md`를 subagent로 호출하여 실제 도구 호출과 페이로드 빌딩을 위임할 수 있다. 단순 호출은 본 skill 본문에서 직접 처리.
