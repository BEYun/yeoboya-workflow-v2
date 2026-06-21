# yeoboya-workflow plugin v2

5개 서비스(달라, 클럽라이브, 여보야, 클럽5678, AI식단) × 2 플랫폼(iOS, Android) × 3 workType(feature, update, bugfix) 개발 워크플로우 자동화.

## 필수 설치사항

- **superpowers 플러그인** (brainstorming, writing-plans, executing-plans 등)
- **Notion MCP** (`mcp__claude_ai_Notion__*` 도구군)

둘 중 하나라도 누락되면 `/yeoboya-setup-workspace`가 차단한다.

## SOT 분리

| 데이터 | SOT |
|---|---|
| 작업 메타데이터 + Notion 문서 링크 (workType 라벨, `links` — 작성자 무관 문서 존재의 로컬 캐시) | 로컬 `.workflow/<작업번호>/work.json` (권위 출처는 Notion 작업 row 자식 페이지) |
| write-code phase 진행 | 로컬 `.workflow/<작업번호>/code-phases.json` |
| write-code phase spec | 로컬 `.workflow/<작업번호>/phases/<phase명>.md` |
| 산출물 본문 (정책서/흐름도/QA 등) | Notion |
| 워크스페이스 설정 | 로컬 `.workflow/workspace.json` |

연결 규칙: `work.json.links[<key>]`로 작업목록 항목과 Notion 산출물을 연결한다. 다중 페이지 항목(draw-data-flow)은 `links[<key>][<페이지 제목>]`.

`links`의 권위 출처는 Notion(작업 row의 자식 페이지)이고 work.json.links는 캐시다. 문서 작업목록 skill은 진입 시 `yeoboya-publish-notion mode="sync-links"`로 links를 동기화하며, 매칭·쓰기는 `hooks/lib/sync-links.js`(결정적 node)가 수행한다.

진행 상태(stage status)·파이프라인 개념은 없다. 작업목록 항목은 순서·선행조건 없이 자유 선택된다. 항목이 "실행됨"인지는 `links`에 키가 존재하는지로만 판단하며, 별도 상태값을 두지 않는다. Notion 링크·메타데이터는 로컬(work.json), 산출물 본문은 Notion이 SOT.

## skill 호출 규약

- **user-invocable 진입은 3개**: `/yeoboya-setup-workspace`, `/yeoboya-create-work`, `/yeoboya-route-work`
- 작업목록 스킬은 모두 `user-invocable: false`. `route-work`이 Skill 도구로 trigger한다
- **항목 단위 세션 분리 권장**: 항목 완료 후 새 세션에서 `/yeoboya-route-work` 재호출
- **write-code 진입 게이트**: `route-work`이 write-code trigger 직전 `sync-links`로 links를 최신화한 뒤 필수 문서 집합(`{정책서, UI 흐름도, 데이터 흐름도}`)을 검사한다. **workType=feature는 하나라도 없으면 하드 블록**, update/bugfix는 경고 후 진행 가능.
- **finish-work 하드 선행조건**: `work.json.reviewDone === true`일 때만 실행 가능. route-work와 finish-work 양쪽에서 확인. 플래그(reviewDone) 기반 하드 선행조건은 이것이 유일하다. (write-code는 feature에 한해 필수 문서 게이트라는 별도 하드 블록이 있다 — 위 write-code 진입 게이트 불릿 참조.) 그 외 항목에는 선행조건 없음.

## skill self-validation 원칙

각 작업목록 스킬은 Notion publish 직전 자기 산출물을 자체 검증한다. 검증 체크리스트는 각 skill 본문 또는 `skills/<name>/references/`에 명시. content-validate hook은 없다.

## 상태/스키마/상수 단일 출처

상태 파일 스키마, 모든 작업목록 키와 라벨 매핑(`WORK_LIST`/`WORK_GROUPS`/`WORK_LABELS`) — 전부 `references/state-schema.md`에 있다. TITLE_TO_KEY/KEY_TO_TITLE 런타임 정의는 `hooks/lib/constants.json` 참조. skill 본문에 중복 정의 금지.
