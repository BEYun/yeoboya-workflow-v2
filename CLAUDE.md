# yeoboya-workflow plugin

5개 서비스(달라, 클럽라이브, 여보야, 클럽5678, AI식단) × 2 플랫폼(iOS, Android) × 3 workType(feature, update, bugfix) 개발 워크플로우 자동화.

## 필수 설치사항

- **superpowers 플러그인** (brainstorming, writing-plans, executing-plans 등)
- **Notion MCP** (`mcp__<notion-server>__notion-*` 도구군 — `<notion-server>` 접두사는 커넥터마다 다르다(로컬 구성 시 이름, claude.ai 커넥터 시 UUID). 플러그인은 서버명에 결합하지 않고 `notion-*` 도구명 suffix로 매칭한다. suffix 단일 출처: `hooks/lib/constants.json` `NOTION_TOOL_NAMES`)
- **하네스 플러그인** (`work` 닫힌 루프 엔진 + `harness-root`/`harness-module`/`harness-check`/`harness-update`). write-code가 코드 구현을 `work`에 위임하므로 하드 의존이다.

셋 중 하나라도 누락되면 `/yeoboya-setup-workspace`가 차단한다. 추가로 setup-workspace는 현재 repo의 하네스 **부트스트랩**을 확인해 `workspace.json.harness.bootstrapped`에 기록한다. 부트스트랩 판정은 **루트 문서 존재**(`CLAUDE.md` + `docs/CONVENTIONS.md` + 내용 있는 `docs/rules/TESTING.md`)로만 한다 — 이 문서는 `harness-root` 1회 실행으로 만들어진다. `harness-module`(leaf 모듈별 CLAUDE.md)은 모듈이 있는 repo에서만 유용하며 부트스트랩 게이트의 선행조건이 아니다.

단, **플래그를 쓰는 주체는 오직 setup-workspace다**. `harness-root`는 문서만 생산하고 `bootstrapped`를 건드리지 않으며, write-code 등 다른 스킬은 이 플래그를 **읽기만** 하고 repo를 재스캔하지 않는다(state-schema §3). 따라서 harness-root 실행 후에는 반드시 `/yeoboya-setup-workspace`를 **다시 호출**해 문서 존재를 재검증해야 `bootstrapped=true`로 확정된다.

**디자인/API 연동 (선택적)**: write-code는 첫 호출 시 디자인·API 컨텍스트를 받아 `plan.md`에 주입한다(코드 생성 아님 — `work`이 이 컨텍스트로 구현). 디자인 툴 MCP(**Figma/Zeplin**)는 **선택적 연동**이다 — setup-workspace가 서비스별로 사용 툴을 물어 `workspace.json.design`에 기록하며 **하드 차단이 아니다**(3대 선행조건과 구분). Swagger API 스펙은 사내망이라 WebFetch가 아닌 로컬 `curl`로 취득한다(`hooks/lib/swagger-extract.js` 헬퍼, URL은 write-code에서 작업마다 입력). 설계: `docs/superpowers/specs/2026-07-02-write-code-design-api-context-design.md`.

## SOT 분리

| 데이터 | SOT |
|---|---|
| 작업 메타데이터 + Notion 문서 링크 (workType 라벨, `links` — 작성자 무관 문서 존재의 로컬 캐시) | 로컬 `.workflow/<작업번호>/work.json` (권위 출처는 Notion 작업 row 자식 페이지) |
| write-code 코드 작업 계획서 | 로컬 `.workflow/<작업번호>/plan.md` (write-code 산출, 하네스 `work` 입력) |
| 코드 구현 진행/검증 상태 | 하네스 `.harness/runs/run-{id}.md` (`work` 소유, gitignore — workflow가 직접 다루지 않음) |
| 코드 작업 시작 기준점 | `work.json.codeBaseSha` (review-code/finish-work의 range 수집 기준) |
| 산출물 본문 (정책서/흐름도/QA 등) | Notion |
| 워크스페이스 설정 | 로컬 `.workflow/workspace.json` |
| 워크플로우 마찰(불편) 기록 | 로컬 `.workflow/improvement-log.jsonl` (gitignore, append-only. `/yeoboya-insights`가 소비) |

연결 규칙: `work.json.links[<key>]`로 세부작업과 Notion 산출물을 연결한다. 다중 페이지 세부작업(draw-data-flow)은 `links[<key>][<페이지 제목>]`. 버전드 세부작업(write-policy-feedback)도 같은 다중 구조로, 기획서 버전마다 `"기획서 검토 - <버전>"` 새 페이지를 만들어 `links[<key>][<전체 제목>]`에 누적한다(단일 페이지 update 아님 — `VERSIONED_TITLE_PREFIXES`, state-schema §4 / notion-schema §1).

`links`의 권위 출처는 Notion(작업 row의 자식 페이지)이고 work.json.links는 캐시다. 문서 세부작업 스킬은 진입 시 `yeoboya-publish-notion mode="sync-links"`로 links를 동기화하며, 매칭·쓰기는 `hooks/lib/sync-links.js`(결정적 node)가 수행한다.

## 세부작업 모델

- 진행 상태(stage status)·파이프라인 개념 없음. 세부작업은 순서·선행조건 없이 자유 선택된다(게이트는 아래 `스킬 호출 규약` 참조).
- "실행됨" 판정은 `work.json.links`에 키 존재 여부로만 — 별도 상태값 없음.
- 세부작업 목록은 **workType별로 다르다**:
  - **feature / update**: 10개, 동일 메뉴 구성, 라벨만 작성↔수정으로 갈림. update의 4개 문서 스킬(write-policy/write-domain/draw-ui-flow/draw-data-flow)은 이전 Notion 문서 복사 수정(분기 A) 또는 코드베이스 기반 산출(분기 B) 중 하나로 처리하고 이전 버전 provenance를 명시한다(state-schema §6).
  - **bugfix**: 6개, 기획·설계 없이 `진단`(버그 분석→QA 시나리오).
- 그룹 `테스트` → `QA 대응`으로 개명.

## 스킬 호출 규약

- **user-invocable 진입은 5개**: `/yeoboya-setup-workspace`, `/yeoboya-create-work`, `/yeoboya-select-subtask`, `/yeoboya-insights`(마찰 로그 분석), `/yeoboya-edit-work`(변경 전파). 뒤 둘은 세부작업이 아닌 select-subtask 흐름 밖의 독립 도구다.
- 세부작업 스킬은 모두 `user-invocable: false`. `select-subtask`이 Skill 도구로 trigger한다
- **세부작업 단위 세션 분리 권장**: 세부작업 완료 후 새 세션에서 `/yeoboya-select-subtask` 재호출
- **write-code 진입 게이트**: `select-subtask`이 write-code trigger 직전 `sync-links`로 links를 최신화한 뒤 필수 문서 집합(`{정책서, UI 흐름도, 데이터 흐름도}`)을 검사한다. **workType=feature는 하나라도 없으면 하드 블록**, update/bugfix는 경고 후 진행 가능.
- **버그 분석 선행 경고(소프트)**: bugfix에서 `write-qa`(QA 시나리오) 선택 시 `work.json.links`에 `analyze-bug`(버그 분석)이 없으면 경고 후 진행 가능(차단 아님). 하드 게이트가 아니다.
- **write-code = 하네스 work 위임 래퍼**: write-code는 더 이상 phase를 직접 실행하지 않는다. 선행 Notion 산출물+하네스 문서로 `.workflow/<작업번호>/plan.md`를 만들고 `work.json.codeBaseSha`를 기록한 뒤, 하네스 플러그인의 `work` 닫힌 루프(plan-reviewer→TDD→검증→bug-fix→harness-check→harness-update)에 구현을 위임한다. 하네스 부트스트랩 미확인(`harness.bootstrapped ≠ true`) 시 write-code는 하네스 work을 호출하지 않고 setup-workspace 재실행을 안내한다. **work이 모든 완료기준 통과를 보고하면 write-code가 `work.json.codeWriteDone=true`를 기록한다**(중단 시 미기록). bugfix의 `fix-bug`도 수정 완료 시 동일하게 기록한다 — 코드 세부작업은 Notion 산출물이 없어 `links`에 키가 안 생기므로 이 플래그가 완료 표시·게이트의 유일 근거다.
- **review-code 하드 선행조건**: `work.json.codeWriteDone === true`일 때만 실행 가능(select-subtask 진입 게이트, workType 무관). 코드 작성/수정이 끝나기 전 리뷰 진입을 막는다.
- **finish-work 하드 선행조건**: `work.json.codeReviewDone === true`일 때만 실행 가능. select-subtask와 finish-work 양쪽에서 확인. 플래그 기반 하드 선행조건은 `codeWriteDone`→review-code, `codeReviewDone`→finish-work 둘뿐이다. (write-code는 feature에 한해 필수 문서 게이트라는 별도 하드 블록이 있다 — 위 write-code 진입 게이트 불릿 참조.) 그 외 세부작업에는 선행조건 없음.
- **edit-work = 변경 전파 오케스트레이터**(독립 진입점, 세부작업 아님): 작업 진행 중 정책·흐름·명세가 바뀌면 activeWork에 대해 변경 델타를 받아 ① 영향 범위(정책서~QA)를 판단해 사용자 확정 → ② 영향 문서를 의존 순서로 기존 문서 스킬(write-policy/write-domain/draw-ui-flow/draw-data-flow/write-qa)에 재trigger해 갱신(trigger 시 "기존 페이지 seed로 델타만 반영"을 workType 무관하게 지시) → ③ 코드가 영향받고 착수됨(plan.md 존재)이면 plan.md를 수정 델타로 재프레이밍하고 `codeWriteDone`/`codeReviewDone=false` 리셋(`codeBaseSha` 유지) 후 write-code 경유로 재작성 위임. 확정 직후 마찰 로그에 `spec-change` 1건을 남겨 insights가 스펙 변경 빈도를 추적한다. 설계: `docs/superpowers/specs/2026-07-02-edit-work-change-propagation-design.md`.

## 스킬 self-validation 원칙

각 세부작업 스킬은 Notion publish 직전 자기 산출물을 자체 검증한다. 검증 체크리스트는 각 스킬 본문 또는 `skills/<name>/references/`에 명시. content-validate hook은 없다.

## 상태/스키마/상수 단일 출처

상태 파일 스키마, 모든 세부작업 키와 라벨 매핑(`SUBTASK_LIST` 12키 등록부 / `SUBTASK_GROUPS`=workType별 그룹 구성 / `SUBTASK_LABELS`=키×workType 라벨) — 전부 `references/state-schema.md`에 있다. TITLE_TO_KEY/KEY_TO_TITLE 런타임 정의는 `hooks/lib/constants.json` 참조. 스킬 본문에 중복 정의 금지.

## 개발/테스트

hooks/lib 의 결정적 node 로직(sync-links, notion, work, swagger-extract, hook-runtime 등)은 `hooks/tests/`에 테스트가 있다. 추가로 `templates.test.js`가 4개 산출물 템플릿(정책서·도메인·UI 흐름도·데이터 흐름도의 `references/*-template.md`) 구조를 검증한다 — 각 템플릿에 `이전 버전:` provenance 라인 + `## 변경 이력` 제목(§ 번호 없이) + `참고본` 열이 있어야 한다. package.json 없음 — node 내장 러너로 직접 실행한다:

```bash
node --test hooks/tests/*.test.js   # 전체 (103 tests). 디렉터리형 `node --test hooks/tests/`는 파일을 못 잡아 실패하니 glob 필수
```

스킬 SKILL.md·agent 본문(산문)은 테스트 대상이 아니지만, 위 4개 산출물 템플릿은 `templates.test.js`가 구조를 강제한다 — 템플릿의 후행 메타 섹션(정책서 미정 항목·변경 이력)에 § 번호를 붙이거나 `참고본` 열을 빼면 테스트가 실패한다. 상수·라벨·스키마 변경 시 `references/state-schema.md`(SOT)와 `hooks/lib/constants.json`을 함께 갱신하고 위 테스트를 돌린다.
