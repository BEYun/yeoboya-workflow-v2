# state-schema

This document is the **single source of truth** for state file schemas and shared constants. Skills, hooks, and tests reference this — never duplicate.

## 1. `.workflow/<작업번호>/work.json`

```json
{
  "work": "DCL-1234",
  "workType": "feature",
  "name": "라이브 방송 검색",
  "referenceWork": "DCL-1230",
  "links": {
    "write-policy":   "abc...",
    "draw-data-flow": { "데이터 흐름도": "p1...", "통신 명세서": "p2..." }
  }
}
```

- `workType` ∈ {`feature`, `update`, `bugfix`} — **라벨 전용. 분기에 쓰지 않는다.**
- `links`: 실행되어 Notion 페이지가 생긴 항목만 등재(sparse). 단일 페이지 → pageId 문자열, 다중 페이지(draw-data-flow) → `{ "<페이지 제목>": "<pageId>" }`.
- `referenceWork`: workType이 update이고 사용자가 참고 작업을 선택했을 때만 존재. 라벨 전용.
- stages/status 개념 없음. 초기화 시 `links: {}`.

## 2. `.workflow/<작업번호>/code-phases.json`

Tracks write-code's internal phase progress. Owned by `yeoboya-write-code`.

```json
{
  "currentPhase": "domain",
  "phases": {
    "data":         { "status": "done" },
    "domain":       { "status": "in-progress" },
    "presentation": { "status": "todo" }
  }
}
```

`phases[<key>].status` ∈ {`todo`, `in-progress`, `done`}.
code-phases는 write-code 내부 phase 추적 전용이며, work.json에는 phase 상태를 두지 않는다.

## 3. `.workflow/workspace.json`

```json
{
  "services": ["달라", "클럽라이브", "여보야", "클럽5678", "AI식단"],
  "platform": "iOS",
  "worker": "윤병은",
  "activeWork": "DCL-1234",
  "notion": {
    "workDbDataSourceUrl": "https://...",
    "workerPageId": "abc...",
    "domainMapping": { "달라": "...", "라이브방송": "..." }
  }
}
```

`activeWork`: most recently started or resumed work. Updated by `create-work` and `route-work`. Used by `session-resume` hook.

Notion MCP is a required prerequisite for v2; there is no `notion.mode` field.

## 4. Shared constants

```
WORK_LIST = [
  "write-policy-feedback", "write-policy", "write-domain",
  "draw-ui-flow", "draw-data-flow",
  "write-code", "fix-bug", "review-code",
  "write-qa", "fix-qa-bug", "finish-work"
]   # route-work 표시 순서

WORK_GROUPS = {
  "기획":   ["write-policy-feedback", "write-policy"],
  "설계":   ["write-domain", "draw-ui-flow", "draw-data-flow"],
  "개발":   ["write-code", "fix-bug", "review-code"],
  "테스트": ["write-qa", "fix-qa-bug"],
  "종결":   ["finish-work"]
}

WORK_LABELS = {
  "write-policy-feedback": "기획서 검토", "write-policy": "정책서 작성",
  "write-domain": "도메인 명세서", "draw-ui-flow": "UI 흐름도",
  "draw-data-flow": "데이터 흐름도", "write-code": "코드 작성",
  "fix-bug": "버그 수정", "review-code": "코드 리뷰",
  "write-qa": "QA 시나리오", "fix-qa-bug": "QA 버그 수정",
  "finish-work": "작업 종결"
}

# TITLE_TO_KEY / KEY_TO_TITLE
# 런타임 정의: hooks/lib/constants.json (단일 SOT)
# 변경 시 해당 파일만 수정한다.

WORKTYPE_LABEL = { feature: "신규 개발", update: "변경/고도화", bugfix: "버그 수정" }

# CODE_PHASES
# write-code Phase Derivation에서 동적 결정. 고정 상수 없음.
# 각 작업의 phase 구성은 .workflow/<작업번호>/code-phases.json 참조.
```

`TITLE_TO_KEY`는 `notion-page-record` hook에서 페이지 제목 → work-list 키 추론에 쓰인다. `draw-data-flow`는 두 페이지("데이터 흐름도", "통신 명세서")가 같은 키로 매핑되며, 두 페이지(데이터 흐름도/통신 명세서)의 pageId가 `links['draw-data-flow']` 객체에 누적된다.

`WORKTYPE_LABEL`은 `create-work`에서 작업 유형 select 값 결정에 쓰인다.

## 5. Read/write conventions

- Skills read/write these files directly via Read/Write/Bash tools — no function wrappers
- Hook code (`hooks/lib/`) reads/writes the same schemas via Node.js
- Schema changes happen here first, then downstream files (hook lib, skill bodies) are updated
