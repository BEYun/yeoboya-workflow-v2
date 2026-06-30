# state-schema

This document is the **single source of truth** for state file schemas and shared constants. Skills, hooks, and tests reference this — never duplicate.

## 1. `.workflow/<작업번호>/work.json`

```json
{
  "work": "DCL-1234",
  "workType": "feature",
  "name": "라이브 방송 검색",
  "referenceWork": "DCL-1230",
  "codeWriteDone": false,
  "codeReviewDone": false,
  "codeBaseSha": "a1b2c3d4",
  "links": {
    "write-policy":   "abc...",
    "draw-data-flow": { "데이터 흐름도": "p1...", "통신 명세서": "p2..." }
  }
}
```

- `workType` ∈ {`feature`, `update`, `bugfix`} — create-work 라벨 + **select-subtask 세부작업 뷰 분기 키**(`SUBTASK_GROUPS`/`SUBTASK_LABELS` §4). 그 외 분기에는 쓰지 않는다.
- `links`: **작성자와 무관하게** 이 작업의 정식 Notion 문서 링크. 키 존재 = 그 문서가 Notion에 존재함. 단일 페이지 → pageId 문자열, 다중 페이지(draw-data-flow) → `{ "<페이지 제목>": "<pageId>" }`. **권위 출처는 Notion(작업 row의 자식 페이지)이며 work.json.links는 그 캐시/인덱스**다. `notion-page-record` hook이 세션 내 생성 페이지를 즉시 기록(fast path)하고, `sync-links`가 작업 row 자식 페이지 전체와 reconcile(authoritative path)한다.
- `referenceWork`: workType이 update이고 사용자가 참고 작업을 선택했을 때만 존재. create-work 라벨 표시 + **update 수정 스킬의 이전 버전 참고 입력**(§6). 선택은 옵션이므로 update여도 없을 수 있다. 해석은 로컬 캐시가 아니라 Notion 권위 출처(referenceWork row 자식 페이지)로 한다(§6).
- `codeWriteDone`: `false`로 초기화. 코드 작성/수정 세부작업 완료 직후 `true`로 갱신 — `write-code`는 하네스 `work` 닫힌 루프가 모든 완료기준 통과를 보고했을 때, bugfix의 `fix-bug`는 버그 수정+테스트가 끝났을 때. `review-code` 진입 **하드 선행조건**이자 select-subtask 완료 마커(✓)의 근거. `links`에 키가 생기지 않는 코드 세부작업(Notion 산출물 없음)의 완료를 표시하는 유일한 수단이다.
- `codeReviewDone`: `false`로 초기화. `review-code` 완료 시 `true`로 갱신. `finish-work` 진입 하드 선행조건. (`codeWriteDone`과 함께 boolean 플래그 기반 하드 선행조건은 이 둘뿐이다 — `codeWriteDone`→review-code, `codeReviewDone`→finish-work.)
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
  "worker": "홍길동",
  "activeWork": "DCL-1234",
  "harness": { "bootstrapped": true, "checkedAt": "2026-06-28" },
  "notion": {
    "workDbDataSourceUrl": "https://...",
    "workerPageId": "abc..."
  }
}
```

`activeWork`: most recently started or resumed work. Updated by `create-work` and `select-subtask`. Used by `session-resume` hook.
`notion.workDbDataSourceUrl`/`workerPageId`: setup-workspace가 §2.5에서 Notion fetch로 확정해 캐시한 값(사용자 자유입력 아님). `workDbDataSourceUrl`은 `서비스 목록 → <서비스> → 작업 목록 → 작업 DB` 계층을 타고 내려가 얻은 선택 서비스의 작업 DB data source. `workerPageId`는 워크스페이스 계정(get-users)이 아니라 공용 `팀원 목록` DB에서 `이름`으로 매칭한 **행 페이지**(notion-schema.md §1 참조). `domainMapping` 필드는 제거됨 — 작업의 도메인은 Notion 작업 row의 `도메인` select가 권위 출처이며 workspace는 보유하지 않는다.
`harness.bootstrapped`: setup-workspace가 현재 repo의 하네스 문서(CLAUDE.md + docs/CONVENTIONS.md + docs/rules/TESTING.md, 그리고 TESTING.md 테스트 명령 비어있지 않음) 존재를 **1회 확인**한 결과. `true`여야 write-code가 `work`을 호출한다. 다른 스킬은 이 플래그만 읽고 repo를 재스캔하지 않는다. `checkedAt`은 `TZ=Asia/Seoul date +%Y-%m-%d`(감사용, 선택).

Notion MCP is a required prerequisite; there is no `notion.mode` field.

## 4. Shared constants

```
SUBTASK_LIST = [
  "write-policy-feedback", "write-policy", "write-domain",
  "draw-ui-flow", "draw-data-flow", "write-qa",
  "analyze-bug", "write-code", "fix-bug", "review-code",
  "fix-qa-bug", "finish-work"
]   # 전체 12개 키 등록부 (가시성·라벨 무관). 키 정본 — 표시 순서는 workType별 SUBTASK_GROUPS가 결정.

# workType → { 그룹: [키…] }. 그룹/키 순서가 곧 select-subtask 표시 순서.
SUBTASK_GROUPS = {
  feature: {
    "기획":    ["write-policy-feedback", "write-policy"],
    "설계":    ["write-domain", "draw-ui-flow", "draw-data-flow", "write-qa"],
    "개발":    ["write-code", "review-code"],
    "QA 대응": ["fix-qa-bug"],
    "종결":    ["finish-work"]
  },
  update: {   # 구성은 feature와 동일, 라벨만 '수정'
    "기획":    ["write-policy-feedback", "write-policy"],
    "설계":    ["write-domain", "draw-ui-flow", "draw-data-flow", "write-qa"],
    "개발":    ["write-code", "review-code"],
    "QA 대응": ["fix-qa-bug"],
    "종결":    ["finish-work"]
  },
  bugfix: {
    "진단":    ["analyze-bug", "write-qa"],
    "개발":    ["fix-bug", "review-code"],
    "QA 대응": ["fix-qa-bug"],
    "종결":    ["finish-work"]
  }
}

# 키 → { workType: 라벨 }. 해당 workType의 SUBTASK_GROUPS에 없으면 그 키 생략.
SUBTASK_LABELS = {
  "write-policy-feedback": { feature: "기획서 검토",  update: "기획서 검토" },
  "write-policy":          { feature: "정책서 작성",  update: "정책서 수정" },
  "write-domain":          { feature: "도메인 명세서", update: "도메인 명세서 수정" },
  "draw-ui-flow":          { feature: "UI 흐름도",    update: "UI 흐름도 수정" },
  "draw-data-flow":        { feature: "데이터 흐름도", update: "데이터 흐름도 수정" },
  "write-qa":              { feature: "QA 시나리오",  update: "QA 시나리오",  bugfix: "QA 시나리오" },
  "analyze-bug":           { bugfix:  "버그 분석" },
  "write-code":            { feature: "코드 작성",    update: "코드 수정" },
  "fix-bug":               { bugfix:  "버그 수정" },
  "review-code":           { feature: "코드 리뷰",    update: "코드 리뷰",   bugfix: "코드 리뷰" },
  "fix-qa-bug":            { feature: "QA 버그 수정", update: "QA 버그 수정", bugfix: "QA 버그 수정" },
  "finish-work":           { feature: "작업 종결",    update: "작업 종결",   bugfix: "작업 종결" }
}

# TITLE_TO_KEY / KEY_TO_TITLE
# 런타임 정의: hooks/lib/constants.json (단일 SOT). analyze-bug↔"버그 분석" 포함.
# 변경 시 해당 파일만 수정한다.

# KEY_TO_ROW_HEADING
# 런타임 정의: hooks/lib/constants.json (단일 SOT). KEY_TO_TITLE와 같은 인덱스 정렬의
# 병렬 배열. 산출물 자식 페이지를 작업 DB row에 publish할 때, row 본문에서 그 자식 페이지
# '위에' 놓을 제목2(heading_2) 텍스트다(notion-schema §1, publish-notion §4). 값은 대개
# KEY_TO_TITLE과 동일하나 write-policy-feedback만 "기획서 검토 결과"로 다르다. 다중(고정) 페이지
# 키(draw-data-flow)는 각 제목별로 자기 제목2를 가진다. 버전드 키(write-policy-feedback)는
# 모든 버전 페이지가 단일 제목2("기획서 검토 결과") 하나를 공유한다(제목2 존재 여부로 멱등 삽입).

# VERSIONED_TITLE_PREFIXES
# 런타임 정의: hooks/lib/constants.json (단일 SOT). { key: 제목 접두사 }. 이 키의 산출물은
# 기획서 '버전마다 새 페이지'를 만든다(단일 페이지 update 아님). 페이지 제목은
# "<접두사> - <버전>"(예 "기획서 검토 - v0.7"). 현재 write-policy-feedback="기획서 검토" 하나.
# - resolveKey(notion.js): 정확 매칭 실패 시 이 접두사로 매칭(제목 === 접두사 또는 "<접두사> -"로
#   시작). 따라서 형제 제목2 "기획서 검토 결과"는 매칭되지 않는다(접두사+" -" 미일치).
# - isMultiPageKey(notion.js): 버전드 키는 다중 페이지로 취급 → links[key][전체제목]에 버전별 누적
#   (draw-data-flow의 {title:id}와 동일 구조). 같은 버전 재게시만 해당 페이지 update.

# NOTION_TOOL_NAMES = { search: "notion-search", createPages: "notion-create-pages", updatePage: "notion-update-page",
#                       createDatabase: "notion-create-database", queryDataSources: "notion-query-data-sources" }
# 런타임 정의: hooks/lib/constants.json (단일 SOT). createDatabase/queryDataSources는 write-qa의 QA 시나리오
# 데이터베이스 산출물(notion-schema §1, publish-notion dispatch-db §4.5)에서 쓰는 suffix다. hook의 write 도구
# 판정(isNotionWriteTool)은 createPages/updatePage만 사용하므로 이 두 키 추가는 hook 동작에 영향이 없다.
# Notion MCP 도구는 mcp__<server>__<toolName> 구조이고 <server> 접두사는 커넥터마다
# 다르다(로컬=이름, claude.ai 커넥터=UUID). hook/스킬은 서버명에 결합하지 말고 이 toolName
# suffix로 매칭한다(notion.js: isNotionWriteTool/notionToolKind = ^mcp__.+__<suffix>$).
# hooks.json matcher 정규식·스킬 본문·CLAUDE.md는 require 불가라 이 값을 미러링한다(정본은 여기).

WORKTYPE_LABEL = { feature: "신규 개발", update: "변경/고도화", bugfix: "버그 수정" }

# write-code는 phase 상수를 두지 않는다. 코드 작업은 하네스 `work` 닫힌 루프에 위임된다.
# write-code는 feature/update 뷰에만 노출된다(bugfix는 fix-bug로 코드 변경).
```

`TITLE_TO_KEY`는 `notion-page-record` hook에서 페이지 제목 → work-list 키 추론에 쓰인다. `draw-data-flow`는 두 페이지("데이터 흐름도", "통신 명세서")가 같은 키로 매핑되며, 두 페이지(데이터 흐름도/통신 명세서)의 pageId가 `links['draw-data-flow']` 객체에 누적된다.

`WORKTYPE_LABEL`은 `create-work`에서 작업 유형 select 값 결정에 쓰인다.

## 5. Read/write conventions

- Skills read/write these files directly via Read/Write/Bash tools — no function wrappers
- Hook code (`hooks/lib/`) reads/writes the same schemas via Node.js
- Schema changes happen here first, then downstream files (hook lib, skill bodies) are updated
- `links` 동기화는 `hooks/lib/sync-links.js`가 담당: 작업 row 자식 페이지 `[{title,id}]`를 stdin으로 받아 `resolveKey`(constants.json)로 매칭·병합·atomicWrite. LLM은 links를 직접 쓰지 않는다.

## 6. update 수정 스킬: 이전 버전 해석 + 코드베이스 산출 규칙

라벨이 `작성→수정`으로 바뀌는 **문서 산출 4개 스킬**(`write-policy`, `write-domain`, `draw-ui-flow`, `draw-data-flow`)은 workType=update일 때 본 산출물을 **이전 노션 문서 복사 기반 수정(분기 A)** 또는 **코드베이스 기반 산출(분기 B)** 둘 중 하나로 처리한다. 순수 신규 작성(B-fallback)은 없다. 이 규칙의 정의는 여기 1곳뿐이며 각 스킬 본문은 이를 참조한다(중복 정의 금지).

**책임 위치**: 각 스킬 §1 전제 / §2 입력 fetch. `select-subtask`은 관여하지 않는다 — 디스패처의 책임은 §7에서 `referenceWork`를 trigger 컨텍스트로 넘기는 것까지다. 이 부재 처리는 **항상 소프트**다(하드 게이트 = write-code 필수문서 + codeWriteDone→review-code + codeReviewDone→finish-work, 불변).

**개념 분리**: content seed(내용 출발점) = 후보 해석. provenance(이전 버전 출처 명시) = seed의 실제 기원. 자기 재publish로 seed를 가져와도 `referenceWork`가 있으면 provenance는 referenceWork를 유지한다(혈통은 재실행과 무관).

**실행 절차** (진입 `sync-links` 직후):

1. **이전 노션 문서 후보 해석** (우선순위):
   - **(1) 자기 작업 재publish** — `work.json.links[<key>]` 존재 시 그 페이지가 seed.
   - **(2) 참고 작업(referenceWork)** — `work.json.referenceWork` 존재 시 **Notion 권위 출처로 해석**한다: `yeoboya-publish-notion mode="list-children"`(work=referenceWork)로 referenceWork row의 자식 페이지 `[{title,id}]`를 **read-only로 나열**한다(work.json 미기록 — `sync-links`와 달리 캐시에 쓰지 않는다). 나열 결과에서 `KEY_TO_TITLE[<key>]` 제목과 매칭되는 페이지의 `pageId`를 seed로 삼는다. 로컬 `.workflow/<referenceWork>/work.json.links` 캐시에 의존하지 않는다(캐시 부재·타 머신 생성 케이스 대응). 다중 페이지 키(draw-data-flow)는 두 제목("데이터 흐름도"/"통신 명세서") 모두 매칭.

2. **분기** (B-fallback 없음 — A 아니면 B):
   - **분기 A — 후보 있음** → seed 페이지를 `notion-fetch`해 수정의 출발점으로 삼고, 상류 기획서 입력 + 사용자 요청으로 수정한 뒤 `publish-notion mode="dispatch"`로 republish한다. §변경 이력에 이번 수정 1행 추가.
   - **분기 B — 후보 없음** → 코드베이스 기반 산출. 사용자에게 기준 모듈/파일 경로를 요청하고, 지정 경로를 읽어 현재 동작을 산출(baseline)한 뒤 상류 기획서/사용자 요청을 반영한다. §변경 이력 첫 행을 `최초 작성`으로 기록.
     ```
     참고할 이전 노션 문서가 없습니다. 코드베이스 기반으로 현재 동작을 산출합니다.
     기준이 될 모듈/파일 경로를 알려주세요 (예: lib/features/penalty/).
     ```

3. **provenance 기록** (seed의 실제 기원을 메타/헤더 + 변경 이력 양쪽에):

   | seed | 메타 "이전 버전" | 변경 이력 참고본 |
   |---|---|---|
   | referenceWork 노션 문서 | `<referenceWork> (노션 링크)` | `<referenceWork>` |
   | 자기 재publish + referenceWork 설정 | `<referenceWork> (노션 링크)` | `<referenceWork>` |
   | 자기 재publish + referenceWork 없음 | `—` | `—` |
   | 코드베이스 (분기 B) | `코드베이스 (<지정 경로>)` | `코드베이스: <경로>` |

   분기 B인데 `referenceWork`도 설정된 경우(referenceWork에 해당 문서가 노션에 없음) 메타에 보조로 `(참고 작업: <referenceWork>)`를 병기할 수 있다.

   메타/헤더 "이전 버전"의 `(노션 링크)`는 분기 A에서 `notion-fetch`한 seed 페이지의 Notion URL(seed `pageId` 기반)을 사용한다. 분기 B에는 노션 링크가 없다(`코드베이스 (<지정 경로>)`만 기록).

라벨이 불변인 스킬(`write-qa`, `write-policy-feedback`)과 `write-code`(하네스 `work` 재개로 수정 처리, Notion 문서 없음)는 이 규칙에서 제외한다.
