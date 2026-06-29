# yeoboya-workflow plugin v2

5개 서비스(달라, 클럽라이브, 여보야, 클럽5678, AI식단) × 2 플랫폼(iOS, Android) × 3 workType(feature, update, bugfix) 개발 워크플로우 자동화.

## 필수 설치사항

- **superpowers 플러그인** (brainstorming, writing-plans, executing-plans 등)
- **Notion MCP** (`mcp__claude_ai_Notion__*` 도구군)
- **하네스 플러그인** (`work` 닫힌 루프 엔진 + `harness-root`/`harness-module`/`harness-check`/`harness-update`). write-code가 코드 구현을 `work`에 위임하므로 하드 의존이다.

셋 중 하나라도 누락되면 `/yeoboya-setup-workspace`가 차단한다. 추가로 setup-workspace는 현재 repo의 하네스 **부트스트랩**(harness-root/harness-module 1회 실행)을 확인해 `workspace.json.harness.bootstrapped`에 기록한다.

## SOT 분리

| 데이터 | SOT |
|---|---|
| 작업 메타데이터 + Notion 문서 링크 (workType 라벨, `links` — 작성자 무관 문서 존재의 로컬 캐시) | 로컬 `.workflow/<작업번호>/work.json` (권위 출처는 Notion 작업 row 자식 페이지) |
| write-code 코드 작업 계획서 | 로컬 `.workflow/<작업번호>/plan.md` (write-code 산출, 하네스 `work` 입력) |
| 코드 구현 진행/검증 상태 | 하네스 `.harness/runs/run-{id}.md` (`work` 소유, gitignore — workflow가 직접 다루지 않음) |
| 코드 작업 시작 기준점 | `work.json.codeBaseSha` (review-code/finish-work의 range 수집 기준) |
| 산출물 본문 (정책서/흐름도/QA 등) | Notion |
| 워크스페이스 설정 | 로컬 `.workflow/workspace.json` |

연결 규칙: `work.json.links[<key>]`로 세부 작업과 Notion 산출물을 연결한다. 다중 페이지 세부 작업(draw-data-flow)은 `links[<key>][<페이지 제목>]`.

`links`의 권위 출처는 Notion(작업 row의 자식 페이지)이고 work.json.links는 캐시다. 문서 세부작업 스킬은 진입 시 `yeoboya-publish-notion mode="sync-links"`로 links를 동기화하며, 매칭·쓰기는 `hooks/lib/sync-links.js`(결정적 node)가 수행한다.

진행 상태(stage status)·파이프라인 개념은 없다. 세부작업 목록은 **workType별로 다르다** (feature/update 10개·동일 메뉴 구성·라벨 작성↔수정 — 단 update는 4개 문서 스킬(write-policy/write-domain/draw-ui-flow/draw-data-flow)이 이전 노션 문서 복사 기반 수정(분기 A) 또는 코드베이스 기반 산출(분기 B) 중 하나로 처리하고 이전 버전 출처(provenance)를 명시한다(state-schema §6), bugfix 6개 — 기획·설계 없이 `진단`(버그 분석→QA 시나리오)). 그룹 `테스트`는 `QA 대응`으로 개명. 그래도 세부 작업은 순서·선행조건 없이 자유 선택된다(아래 게이트 제외). 세부 작업이 "실행됨"인지는 `links`에 키가 존재하는지로만 판단하며, 별도 상태값을 두지 않는다. Notion 링크·메타데이터는 로컬(work.json), 산출물 본문은 Notion이 SOT.

## skill 호출 규약

- **user-invocable 진입은 3개**: `/yeoboya-setup-workspace`, `/yeoboya-create-work`, `/yeoboya-select-subtask`
- 세부작업 스킬은 모두 `user-invocable: false`. `select-subtask`이 Skill 도구로 trigger한다
- **세부 작업 단위 세션 분리 권장**: 세부 작업 완료 후 새 세션에서 `/yeoboya-select-subtask` 재호출
- **write-code 진입 게이트**: `select-subtask`이 write-code trigger 직전 `sync-links`로 links를 최신화한 뒤 필수 문서 집합(`{정책서, UI 흐름도, 데이터 흐름도}`)을 검사한다. **workType=feature는 하나라도 없으면 하드 블록**, update/bugfix는 경고 후 진행 가능.
- **버그 분석 선행 경고(소프트)**: bugfix에서 `write-qa`(QA 시나리오) 선택 시 `work.json.links`에 `analyze-bug`(버그 분석)이 없으면 경고 후 진행 가능(차단 아님). 하드 게이트가 아니다.
- **write-code = 하네스 work 위임 래퍼**: write-code는 더 이상 phase를 직접 실행하지 않는다. 선행 Notion 산출물+하네스 문서로 `.workflow/<작업번호>/plan.md`를 만들고 `work.json.codeBaseSha`를 기록한 뒤, 하네스 플러그인의 `work` 닫힌 루프(plan-reviewer→TDD→검증→bug-fix→harness-check→harness-update)에 구현을 위임한다. 하네스 부트스트랩 미확인(`harness.bootstrapped ≠ true`) 시 write-code는 하네스 work을 호출하지 않고 setup-workspace 재실행을 안내한다.
- **finish-work 하드 선행조건**: `work.json.reviewDone === true`일 때만 실행 가능. select-subtask와 finish-work 양쪽에서 확인. 플래그(reviewDone) 기반 하드 선행조건은 이것이 유일하다. (write-code는 feature에 한해 필수 문서 게이트라는 별도 하드 블록이 있다 — 위 write-code 진입 게이트 불릿 참조.) 그 외 세부 작업에는 선행조건 없음.

## skill self-validation 원칙

각 세부작업 스킬은 Notion publish 직전 자기 산출물을 자체 검증한다. 검증 체크리스트는 각 skill 본문 또는 `skills/<name>/references/`에 명시. content-validate hook은 없다.

## 상태/스키마/상수 단일 출처

상태 파일 스키마, 모든 세부작업 키와 라벨 매핑(`SUBTASK_LIST` 12키 등록부 / `SUBTASK_GROUPS`=workType별 그룹 구성 / `SUBTASK_LABELS`=키×workType 라벨) — 전부 `references/state-schema.md`에 있다. TITLE_TO_KEY/KEY_TO_TITLE 런타임 정의는 `hooks/lib/constants.json` 참조. skill 본문에 중복 정의 금지.
