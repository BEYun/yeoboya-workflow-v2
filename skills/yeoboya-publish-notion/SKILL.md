---
name: yeoboya-publish-notion
description: "yeoboya-workflow에서 Notion 페이지 쓰기나 작업 DB row 변경에 필수다. 세부작업 스킬에서 `notion-create-pages`나 `notion-update-page`를 직접 호출하지 말 것 — 먼저 이 스킬을 호출한다. work DB row upsert(dispatch), 워크스페이스 인지 속성 설정을 처리하고, `notion-page-record` hook이 pageId를 work.json.links에 기록하는 데 필요한 페이지 제목을 노출한다. 세부작업 스킬(write-policy, write-domain, draw-ui-flow, draw-data-flow, write-qa)이 산출물을 게시해야 할 때, 또는 create-work이 작업 DB row를 등록/동기화해야 할 때 사용한다."
user-invocable: false
---

# yeoboya-publish-notion

Notion 쓰기의 단일 진입점. 모든 세부작업 스킬은 산출물을 publish할 때 본 skill을 통해 Notion에 쓴다.

## 1. 도구 호출 규약

- create 경로: 이름이 `__notion-create-pages`로 끝나는 Notion MCP 도구 (`mcp__<서버>__notion-create-pages` — `<서버>` 접두사는 커넥터마다 다르므로 서버명에 결합하지 말 것)
- update 경로: 이름이 `__notion-update-page`로 끝나는 Notion MCP 도구 (기존 pageId가 있을 때)
- **upsert 규칙**: `work.json.links[<key>]`(다중 페이지는 `links[<key>][<title>]`)가 있으면 update, 없으면 create. 이 판단은 **동기화된 links**를 전제로 한다 — 호출자(세부작업 스킬)는 진입 시 `mode="sync-links"`로 links를 먼저 최신화하므로, 다른 작업자가 만든 기존 페이지도 create가 아니라 update된다(중복 방지).

## 2. 페이지 제목 결정

title은 `hooks/lib/constants.json`의 `KEY_TO_TITLE[key]`에서 결정된다.

- 단일 페이지 키(write-policy, write-domain, draw-ui-flow, write-qa 등): 호출자가 `title`을 전달하지 않는다. publish-notion이 `KEY_TO_TITLE[key][0]`을 페이지 제목으로 사용.
- 다중(고정) 페이지 키(draw-data-flow): 호출자가 `title`을 전달한다. `KEY_TO_TITLE["draw-data-flow"]`의 값("데이터 흐름도" 또는 "통신 명세서") 중 하나여야 한다.
- **버전드 키(write-policy-feedback)** — `constants.json` `VERSIONED_TITLE_PREFIXES`에 등록된 키. 기획서 **버전마다 새 페이지**를 만든다(단일 페이지 update 아님). 호출자가 전체 `title`을 `"<접두사> - <버전>"` 형식으로 전달한다(예: `"기획서 검토 - v0.7"`). 접두사는 `KEY_TO_TITLE[key][0]`(=`"기획서 검토"`). 같은 버전 재게시(동일 title이 `links[key]`에 존재)만 update이고, 새 버전은 항상 create. resolveKey는 이 제목을 접두사로 매칭해 같은 키로 기록한다.

`KEY_TO_TITLE`에 없고 버전드 접두사에도 안 걸리는 key+title 조합은 hook 기록 없이 Notion 페이지만 생성한다 (review-code 등 links 미기록 항목에서 활용).

## 3. 호출 형태

호출 시 다음 파라미터를 받는다:

- `work`: 작업번호 (e.g., "DCL-1234")
- `mode`: "dispatch" | "sync" | "sync-links" | "list-children"
  - `dispatch`: 세부 작업/키 산출물 페이지 create/update. payload: `key`, `title`, `markdown`, 옵션 `properties`. create 시 row 본문에 제목2(heading_2)를 먼저 두고 그 아래 자식 페이지를 둔다(§4).
  - `sync`: 작업 DB row 조회. create-work에서 도메인/담당자 추출용.
  - `sync-links`: 작업 row 자식 페이지를 나열해 work.json.links를 Notion 실제 상태로 동기화. payload: `work`만. (§5.5)
  - `list-children`: 임의 작업 row의 자식 페이지를 **read-only로 나열**해 `[{title,id}]` 반환. work.json에 쓰지 않는다(sync-links와 구분). update 수정 스킬의 referenceWork seed 해석용(state-schema §6). payload: `work`만. (§5.6)

hook(`notion-page-record`)은 페이지 publish 시 `work.json.links`에 pageId를 기록한다. 상태 자동 갱신 기능은 제거되었으며 본 skill은 어떠한 select 필드도 자동 변경하지 않는다.

## 4. dispatch 흐름

1. `work`로 work.json 로드 → 이번 게시 대상 페이지의 기존 pageId 확인:
   - 단일 키: `links[key]`
   - 다중/버전드 키: `links[key][title]` (title = 호출자 전달 전체 제목)
2. workspace.json 로드 → `notion.workDbDataSourceUrl`, `notion.workerPageId`
3. 기존 pageId가 있으면 update-page (replace_content)로 그 페이지를 갱신. 없으면 새 자식 페이지 create:
   - **(a) 제목2(heading_2) ensure** — row 본문에 이 산출물의 제목2가 **이미 있는지 확인하고 없을 때만** 삽입한다. 텍스트는 `constants.json`의 `KEY_TO_ROW_HEADING[key]`(다중 고정 키는 `title`과 같은 인덱스, 그 외 `[0]`). **존재 여부로 멱등** → 버전드 키의 여러 버전은 `"기획서 검토 결과"` **하나의 제목2를 공유**한다(버전마다 새로 만들지 않음).
   - **(b) 자식 페이지 create-pages** (parent = 작업 row). 새 페이지는 해당 제목2 **아래(기존 형제 페이지들 다음)**에 오도록 위치시킨다 — 가능하면 마지막 형제 페이지 뒤에 삽입, 단순 append만 가능하면 row 끝에 추가.
   - 이로써 row에 「제목2 + (그 아래) 자식 페이지(들)」가 묶음으로 쌓인다 (notion-schema §1 "row 본문의 제목2").
4. 응답 반환 — page id

산출물 링크는 hook이 work.json.links에 자동 기록(다중/버전드 키는 title별 누적)하므로 본 skill에서 별도 쓰기 안 함. 제목2는 자식 페이지가 아니라 row 본문 블록이라 hook/sync-links 자식 나열에 잡히지 않는다.

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

## 5.6 list-children 흐름 (read-only)

1. `workspace.json`의 `notion.workDbDataSourceUrl`로 작업 DB에서 `<work>` row를 찾는다 (§5 sync의 row lookup과 동일).
2. notion-writer `list-children`(read-only)로 그 row의 자식 페이지 `[{ "title": ..., "id": ... }, ...]`를 나열해 그대로 반환한다.
3. **work.json을 쓰지 않는다** — `sync-links`와 달리 caller의 links 캐시를 변경하지 않는다(임의 작업, 특히 referenceWork 조회 시 현재 작업 캐시 오염 방지). 제목→키 매칭·seed 선택은 호출자(§6 update 수정 스킬)가 수행한다.

## 6. 호출자(create-work / 세부작업 스킬 / hook)에게 노출되는 인터페이스

```
yeoboya-publish-notion 호출 파라미터:
  work: "DCL-1234"
  mode: "dispatch" | "sync" | "sync-links" | "list-children"
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
  (list-children만)
    임의 작업 row 자식 페이지를 read-only 나열 — work만 필요, work.json 미기록 (§5.6)
```

`담당자` payload는 항상 `mode: "append"` 형식이며 본 skill 내부에서 기존 relation list와 union 연산. 절대 replace하지 않는다.

ID↔URL 변환(예: `workspace.notion.workerPageId` → 페이지 URL)은 본 skill이 책임진다 — 호출자는 정규화된 worker pageId만 전달.

## 7. 에이전트 사용

본 skill은 `notion-writer` 서브에이전트(`agents/notion-writer.md`)를 호출하여 실제 도구 호출과 페이로드 빌딩을 위임할 수 있다. 단순 호출은 본 skill 본문에서 직접 처리.
