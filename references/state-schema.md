# state-schema

This document is the **single source of truth** for state file schemas and shared constants. Skills, hooks, and tests reference this — never duplicate.

## 1. `.workflow/<작업번호>/work.json`

```json
{
  "work": "DCL-1234",
  "workType": "feature",
  "name": "라이브 방송 검색",
  "referenceWork": "DCL-1230",
  "reviewDone": false,
  "codeBaseSha": "a1b2c3d4",
  "links": {
    "write-policy":   "abc...",
    "draw-data-flow": { "데이터 흐름도": "p1...", "통신 명세서": "p2..." }
  }
}
```

- `workType` ∈ {`feature`, `update`, `bugfix`} — **라벨 전용. 분기에 쓰지 않는다.**
- `links`: **작성자와 무관하게** 이 작업의 정식 Notion 문서 링크. 키 존재 = 그 문서가 Notion에 존재함. 단일 페이지 → pageId 문자열, 다중 페이지(draw-data-flow) → `{ "<페이지 제목>": "<pageId>" }`. **권위 출처는 Notion(작업 row의 자식 페이지)이며 work.json.links는 그 캐시/인덱스**다. `notion-page-record` hook이 세션 내 생성 페이지를 즉시 기록(fast path)하고, `sync-links`가 작업 row 자식 페이지 전체와 reconcile(authoritative path)한다.
- `referenceWork`: workType이 update이고 사용자가 참고 작업을 선택했을 때만 존재. 라벨 전용.
- `reviewDone`: `false`로 초기화. `review-code` 완료 시 `true`로 갱신. `finish-work` 진입 유일 하드 선행조건.
- `codeBaseSha`: write-code가 하네스 `work` 호출 직전 `git rev-parse HEAD`로 기록하는 **코드 작업 시작 SHA**(커밋 없으면 `null`). 재개 시 덮어쓰지 않는다. review-code/finish-work가 `codeBaseSha..HEAD` range로 이 작업의 커밋을 수집하는 기준점. `null`이면 `git log --grep='[<작업번호>]'` legacy 경로로 대체.
- stages/status 개념 없음. 초기화 시 `links: {}`.

## 2. `.workflow/<작업번호>/plan.md`

write-code가 산출하고 하네스 `work`이 입력으로 받는 **코드 작업 계획서**. write-code가 소유하며, work은 이를 읽어 plan-reviewer(7축)·TDD·완료기준 검증을 수행한다. (이전의 phase 기반 진행 추적 방식을 대체 — phase 개념은 폐기됐고 진행 상태는 work이 `.harness/runs/run-{id}.md`로 관리한다.)

고정 섹션:

```markdown
## 요구사항
<work.json.name + 선행 Notion 산출물(정책서/도메인/데이터 흐름도) 요약>

## 참고 코드
<@경로 목록 — 하네스 모듈 CLAUDE.md 포함>

## 완료기준
- [ ] <자연어 또는 실행 명령 — work이 TESTING.md 기준으로 명령 번역>
- [ ] ...

## 플랫폼
<iOS | Android — workspace.platform>

## 커밋 규약
이 작업의 모든 커밋은 `[<작업번호>]` prefix로 시작한다.
```

plan.md 존재 = write-code가 이미 계획을 세우고 work에 위임을 시작했음(첫 호출 vs 재개의 분기 신호). 진행/완료 상태는 plan.md에 두지 않는다.

## 3. `.workflow/workspace.json`

```json
{
  "services": ["달라", "클럽라이브", "여보야", "클럽5678", "AI식단"],
  "platform": "iOS",
  "worker": "윤병은",
  "activeWork": "DCL-1234",
  "harness": { "bootstrapped": true, "checkedAt": "2026-06-28" },
  "notion": {
    "workDbDataSourceUrl": "https://...",
    "workerPageId": "abc...",
    "domainMapping": { "달라": "...", "라이브방송": "..." }
  }
}
```

`activeWork`: most recently started or resumed work. Updated by `create-work` and `route-work`. Used by `session-resume` hook.
`harness.bootstrapped`: setup-workspace가 현재 repo의 하네스 문서(CLAUDE.md + docs/CONVENTIONS.md + docs/rules/TESTING.md, 그리고 TESTING.md 테스트 명령 비어있지 않음) 존재를 **1회 확인**한 결과. `true`여야 write-code가 `work`을 호출한다. 다른 스킬은 이 플래그만 읽고 repo를 재스캔하지 않는다. `checkedAt`은 `TZ=Asia/Seoul date +%Y-%m-%d`(감사용, 선택).

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

# write-code는 phase 상수를 두지 않는다. 코드 작업은 하네스 `work` 닫힌 루프에 위임된다.
```

`TITLE_TO_KEY`는 `notion-page-record` hook에서 페이지 제목 → work-list 키 추론에 쓰인다. `draw-data-flow`는 두 페이지("데이터 흐름도", "통신 명세서")가 같은 키로 매핑되며, 두 페이지(데이터 흐름도/통신 명세서)의 pageId가 `links['draw-data-flow']` 객체에 누적된다.

`WORKTYPE_LABEL`은 `create-work`에서 작업 유형 select 값 결정에 쓰인다.

## 5. Read/write conventions

- Skills read/write these files directly via Read/Write/Bash tools — no function wrappers
- Hook code (`hooks/lib/`) reads/writes the same schemas via Node.js
- Schema changes happen here first, then downstream files (hook lib, skill bodies) are updated
- `links` 동기화는 `hooks/lib/sync-links.js`가 담당: 작업 row 자식 페이지 `[{title,id}]`를 stdin으로 받아 `resolveKey`(constants.json)로 매칭·병합·atomicWrite. LLM은 links를 직접 쓰지 않는다.
