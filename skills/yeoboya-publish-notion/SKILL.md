---
name: yeoboya-publish-notion
description: "MANDATORY for any Notion page write or work DB row mutation in yeoboya-workflow. NEVER call `notion-create-pages` or `notion-update-page` directly from a 작업목록 skill — invoke this skill first. It handles work DB row upsert (dispatch), workspace-aware property setting, and surfaces the page title that the `notion-page-record` hook needs to record the pageId into work.json.links. Use when any 작업목록 skill (write-policy, write-domain, draw-ui-flow, draw-data-flow, write-qa) needs to publish its deliverable, or when create-work needs to register/sync the work DB row."
user-invocable: false
---

# yeoboya-publish-notion

Notion 쓰기의 단일 진입점. 모든 작업목록 skill은 산출물을 publish할 때 본 skill을 통해 Notion에 쓴다.

## 1. 도구 호출 규약

- create 경로: `mcp__claude_ai_Notion__notion-create-pages`
- update 경로: `mcp__claude_ai_Notion__notion-update-page` (기존 pageId가 있을 때)
- **upsert 규칙**: `work.json.links[<key>]`(다중 페이지는 `links[<key>][<title>]`)가 있으면 update, 없으면 create

## 2. 페이지 제목 규약 (hook이 작업목록 항목 키 추론에 사용)

| 작업목록 항목 키 | 페이지 제목 |
|---|---|
| write-policy-feedback | 기획서 검토 |
| write-policy | 정책서 |
| write-domain | 도메인 명세서 |
| draw-ui-flow | UI 흐름도 |
| draw-data-flow | 데이터 흐름도 · 통신 명세서 (2 페이지) |
| write-qa | QA 시나리오 |

이 매핑은 `references/state-schema.md §4 TITLE_TO_KEY`와 `references/notion-schema.md` 그리고 hook lib `notion.js`의 `TITLE_TO_KEY`가 일치해야 한다. 변경은 세 곳 동시 갱신 (Phase 1·2의 작업들로 한 번에 처리).

## 3. 호출 형태

호출 시 다음 파라미터를 받는다:

- `work`: 작업번호 (e.g., "DCL-1234")
- `mode`: "dispatch" | "sync"
  - `dispatch`: 작업목록 항목/키 산출물 페이지 create/update. payload: `key`, `title`, `markdown`, 옵션 `properties`.
  - `sync`: 작업 DB row 조회. create-work에서 도메인/담당자 추출용.

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

## 6. 호출자(create-work / 작업목록 skills / hook)에게 노출되는 인터페이스

```
yeoboya-publish-notion 호출 파라미터:
  work: "DCL-1234"
  mode: "dispatch" | "sync"
  (dispatch만)
    key: "<작업목록 항목 키>"
    title: "<페이지 제목 — §2 표 참조>"
    markdown: "<페이지 본문>"
    properties?:
      workType?: <feature|update|bugfix>   # WORKTYPE_LABEL로 select 값 변환
      작업명?: string
      도메인?: string                      # 존재하는 select option만
      담당자?: { mode: "append", urls: string[] }   # 항상 append, replace 금지
      iOS_완료?: boolean
      Android_완료?: boolean
```

`담당자` payload는 항상 `mode: "append"` 형식이며 본 skill 내부에서 기존 relation list와 union 연산. 절대 replace하지 않는다.

ID↔URL 변환(예: `workspace.notion.workerPageId` → 페이지 URL)은 본 skill이 책임진다 — 호출자는 정규화된 worker pageId만 전달.

## 7. 에이전트 사용

본 skill은 `agents/notion-writer.md`를 subagent로 호출하여 실제 도구 호출과 페이로드 빌딩을 위임할 수 있다. 단순 호출은 본 skill 본문에서 직접 처리.
