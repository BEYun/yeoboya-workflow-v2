---
name: yeoboya-write-code
description: "yeoboya-select-subtask이 이 세부 작업을 trigger할 때만 사용한다. 직접 호출 금지. 선행 Notion 산출물(정책서/도메인/데이터 흐름도)과 하네스 문서를 읽어 .workflow/<작업번호>/plan.md(코드 작업 계획서)를 작성하고, work.json.codeBaseSha를 기록한 뒤, 하네스 플러그인의 work 닫힌 루프에 구현을 위임한다. phase 시스템은 더 이상 쓰지 않는다. yeoboya-publish-notion을 호출하지 않는다."
user-invocable: false
---

# yeoboya-write-code

코드 작업 계획 수립 + 하네스 `work` 닫힌 루프 위임. (v1 phase 시스템 폐기 — 구현·TDD·검증·bug-fix·harness 루프는 전부 `work`이 주도한다.)
> 이하 `work` = 하네스 work.

## 1. 전제

- work.json 존재.
- select-subtask이 **write-code 진입 게이트(select-subtask §6)**를 이미 통과: sync-links로 `work.json.links`가 최신화되었고, **feature는 정책서·UI 흐름도·데이터 흐름도 3종이 links에 존재함이 보장된다(하드 선행조건)**. update/bugfix는 일부가 없을 수 있다.
- **하네스 부트스트랩 가정**: `.workflow/workspace.json`의 `harness.bootstrapped`를 읽는다(repo 스캔 아님 — 플래그 1회 읽기). `true`가 아니면 아래 안내 후 **즉시 종료**(work을 호출하지 않는다):
  ```
  이 repo는 하네스 부트스트랩이 확인되지 않았습니다(harness.bootstrapped ≠ true).
  /harness-root 실행(leaf 모듈이 있으면 이어서 /harness-module) 후 /yeoboya-setup-workspace를 다시 호출해 부트스트랩을 확정한 뒤 진행하세요.
  ```

## 2. 첫 호출 vs 재개 분기

`.workflow/<작업번호>/plan.md` 존재 여부로 분기:

| 상태 | 분기 |
|---|---|
| 부재 | **첫 호출** — §3 (선행 fetch → brainstorming → plan.md 작성 → codeBaseSha 기록 → work 호출) |
| 존재 | **재개** — §4 (brainstorming 생략, 바로 work 호출. work이 `.harness/runs/run-*.md`로 자체 재개) |

## 3. 첫 호출 흐름

### 3.1 선행 산출물 + 하네스 fetch

- `work.json.links`에 pageId가 있는 항목을 Notion MCP로 읽는다(write-policy, write-domain, draw-data-flow 등 실행된 것만).
- `work.json`의 `workType`·`name`, `workspace.json`의 `platform` 확인.
- 하네스 문서를 읽어 계획의 제약으로 삼는다(현재 repo = git root 기준): `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, 관련 모듈 `CLAUDE.md`.

### 3.2 Brainstorming (계획 수립)

superpowers:brainstorming으로 이 작업의 **코드 작업 계획**을 수립한다(아키텍처 접근, 다룰 모듈, 완료기준). phase 분해가 아니라 **work에 넘길 계획서**가 산출물이다. 사용자와 계획을 확인한 뒤 확정한다.

(superpowers:brainstorming skill 활용 — 호출 명시.)

### 3.3 plan.md 작성

`.workflow/<작업번호>/plan.md`를 아래 고정 섹션으로 작성한다(state-schema.md §2 준수):

```markdown
## 요구사항
<name + 선행 Notion 산출물 요약>

## 참고 코드
<@경로 — 하네스 모듈 CLAUDE.md 포함>

## 완료기준
- [ ] <자연어 또는 실행 명령 — work이 docs/rules/TESTING.md 기준으로 명령 번역>
- [ ] ...

## 플랫폼
<iOS | Android — workspace.platform 값 그대로>

## 커밋 규약
이 작업의 모든 커밋은 `[<작업번호>]` prefix로 시작한다.
- 구현 커밋  : [<작업번호>] <변경 요약>
- bug-fix 커밋 : [<작업번호>] fix: <원인>
```

⚠️ `## 완료기준`은 반드시 `- [ ]` 체크리스트로 쓴다(하네스 `require-completion-criteria` 훅이 체크박스 없는 run 파일 쓰기를 차단하므로, work이 이 체크리스트를 run 파일로 옮겨 쓸 수 있어야 한다).

### 3.4 codeBaseSha 기록

work 호출 직전, 코드 작업 시작 SHA를 work.json에 1회 기록한다:

```bash
git rev-parse HEAD 2>/dev/null   # 출력이 없으면(커밋 없는 repo) codeBaseSha = null
```

`.workflow/<작업번호>/work.json`을 Read → `codeBaseSha` 필드를 위 SHA(또는 null)로 설정 → Write. **`codeBaseSha` 필드가 이미 존재하면(`null` 포함) 덮어쓰지 않는다.**

### 3.5 work 호출

Skill 도구로 하네스 `work` 스킬을 호출하고, plan.md를 입력으로 넘긴다(이름 충돌 시 `yeoboya-workflow-v2:work`):

```
work 호출:
  요구 사항: "@.workflow/<작업번호>/plan.md 를 읽고 구현. 계획 문서이므로 plan-reviewer(7축)를 거친다."
  완료 기준: plan.md의 ## 완료기준 체크리스트
  플랫폼:    plan.md의 ## 플랫폼 (완료기준 명령 번역용)
  커밋 규약: plan.md의 ## 커밋 규약 — 모든 커밋에 [<작업번호>] prefix
```

> plan.md는 `@경로`로 넘기거나 내용을 인라인한다 — 하네스 `work`의 입력 규약(요구 사항·참고 코드에서 `@path` 허용)에 따른다.

work이 계획 검토(plan-reviewer) → TDD → 통합/E2E 작성 → 완료기준 검증 → 실패 시 bug-fix(≤5) → 막히면 harness-check → harness-update 사슬을 주도한다. write-code는 여기서 제어를 work에 넘긴다.

## 4. 재개 흐름

`plan.md`가 이미 존재하면: brainstorming·plan.md 작성·codeBaseSha 기록을 **모두 생략**하고 §3.5(work 호출)만 수행한다. work이 `.harness/runs/run-*.md`의 미완료 run을 찾아 "재개/신규"를 사용자에게 물어 이어받는다.

## 5. 종료

### 5.1 codeWriteDone 기록 (완료 보고 시에만)

work이 **모든 완료기준 통과**를 보고했을 때에만:

`.workflow/<작업번호>/work.json`을 Read → `codeWriteDone` 필드를 `true`로 설정 → Write.

이 플래그가 `review-code` 진입 하드 선행조건이자 select-subtask 완료 마커(✓)의 근거다(state-schema §1). work이 도중 중단(harness-check 사람 게이트, bug-fix 한도 등)된 경우에는 **기록하지 않는다**(미완료 유지 — 재개로 이어진다).

### 5.2 종료 안내

work이 완료를 보고하면:

```
코드 작업 완료 (work 닫힌 루프 종료).
다음 권장 단계: 코드 리뷰.
새 세션에서 /yeoboya-select-subtask을 호출하세요.
```

work이 도중 중단(harness-check 사람 게이트, bug-fix 한도 등)되면 work의 보고를 그대로 사용자에게 전달하고(`codeWriteDone` 미기록), 재개는 `/yeoboya-select-subtask → write-code`(§4)로 안내한다.

## 6. Self-validation

work 호출 전 검증:
- [ ] `harness.bootstrapped === true` 확인됨
- [ ] `plan.md`에 5개 고정 섹션(요구사항/참고 코드/완료기준/플랫폼/커밋 규약) 존재, 완료기준이 `- [ ]` 체크리스트
- [ ] `work.json.codeBaseSha`가 기록됨(첫 호출 시) 또는 보존됨(재개 시)
- [ ] 플랫폼 값이 `workspace.platform`과 일치
