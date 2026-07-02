---
name: yeoboya-draw-ui-flow
description: "yeoboya-select-subtask이 이 세부 작업을 trigger할 때만 사용한다. 직접 호출 금지. 고유 ID를 가진 화면, 화면별 고유 ID를 가진 사용자 액션, 그리고 화면 전환 다이어그램을 정의한다. 모든 화면-액션 쌍이 ID를 갖는지 자체 검증한다(draw-data-flow가 ID 기반 연결에 사용). 'UI 흐름도' 제목의 Notion 페이지를 게시한다."
user-invocable: false
---

# yeoboya-draw-ui-flow

UI 흐름도 작성. **화면(screen)과 사용자 액션(user action)을 ID로 매핑**하여 후속 단계(draw-data-flow)와 연동 가능하게 한다.

## 1. 전제

- work.json 존재.
- 도메인 명세서(work.json.links['write-domain'])가 있으면 참고한다. 없으면 사용자에게 알리고 진행 여부를 확인한다.
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회 호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다 — (a) 다른 작업자가 만든 선행 문서를 links에서 인식, (b) 본 산출물이 이미 있으면 publish가 update가 되어 중복 페이지 방지.

## 2. 입력 fetch

- 도메인 명세서 + 정책서 fetch
- **workType=update 이전 버전 해석** — `references/state-schema.md §6` 규칙대로 이전 UI 흐름도를 해석한다(자기 재publish, 또는 `referenceWork`의 UI 흐름도를 Notion 권위 출처로 해석). **후보 있음(분기 A)** → fetch. **후보 없음(분기 B)** → §6대로 기준 모듈/파일 경로를 사용자에게 요청해 코드베이스 기반 산출. provenance는 §6 표대로 헤더 + 변경 이력에 기록.

## 3. 작성 절차

1. **컨텍스트 분할** — 정책서/도메인 명세서를 읽고 화면이 등장하는 도메인 영역을 컨텍스트로 분할. §0에 라벨.
2. **페르소나 매핑** — 정책서 §페르소나의 한국어 명칭을 그대로 사용. 영문/공백제거 형태가 필요하면 §0에 mapping 명시.
3. **화면 ID 부여** — 패턴 `<컨텍스트>_<페르소나>_NN` (페르소나별 01부터 2자리 패딩).
4. **액션 ID 부여** — 패턴 `<페르소나>:Action:N`. 각 액션은 발생 화면(통합 표의 행)에 귀속되며, 다이어그램에서는 해당 전환 엣지의 라벨로 등장한다.
5. **§1 페르소나별 흐름 작성** — 페르소나마다 다음 3요소를 순서대로 작성한다:
   a. **흐름 요약** — 이 페르소나가 무엇을 하는지 1~2문장(핵심 분기·트리거 포함).
   b. **다이어그램(주역)** — Mermaid flowchart TD. 화면 노드 + 시스템 트리거 + error/unclear/auth 노드로 구성한다. 사용자 액션은 엣지 라벨에 `<액션ID> <단계명>`으로 표기하고, **화면 전환 관계와 엣지 케이스를 모두 이 다이어그램에 담는다(별도 표를 만들지 않는다)**. 색상 범례 4종(error/unclear/auth/system) classDef를 일관 적용한다.
   c. **화면·액션 통합 표** — 열: `화면 ID | 화면 (채널) | 주요 UI 상태 | 사용자 액션 (ID · 단계)`. 화면 목록·화면별 UI 상태·사용자 액션 정의를 이 한 표로 병합한다.
6. **§2 정책 인용 표** — 다이어그램 강조 영역(트리거, 게이트, 토스트 등)에 대해 POL-XXX 출처 + 원문 인용.
7. **정책서 미정 항목** — 다이어그램 unclear 노드를 종합한 목록(없으면 "현재 없음").
8. **변경 이력** (workType=update, `references/state-schema.md §6`) — 이전 버전이 있으면 1행 추가, 이전 버전 없이 신규면 첫 행을 `최초 작성`으로 기록.

본문 구조는 `references/ui-flow-template.md`를 직접 따른다.

## 4. Self-validation (publish 직전)

- [ ] 페이지 제목 = "UI 흐름도"
- [ ] 정책 SOT + 도메인 SOT link 둘 다 footnote에 존재
- [ ] §0 컨텍스트 라벨이 모두 정의되어 있음
- [ ] §0 페르소나 라벨이 정책서 §페르소나 명칭과 일치 (또는 mapping 명시)
- [ ] §1 각 페르소나에 흐름 요약 + 다이어그램 + 화면·액션 통합 표 3요소가 모두 존재
- [ ] 화면 ID는 `<컨텍스트>_<페르소나>_NN` 패턴 + 전역 unique
- [ ] 액션 ID는 `<페르소나>:Action:N` 패턴 + 페르소나별 unique (통합 표 "사용자 액션" 열)
- [ ] 다이어그램에 통합 표의 모든 화면 ID가 등장 (또는 명시적 제외 사유)
- [ ] 통합 표의 모든 액션 ID가 다이어그램 엣지 라벨에 등장
- [ ] 다이어그램에 4종 classDef(error/unclear/auth/system) 모두 정의
- [ ] §2 정책 인용 표가 다이어그램에 등장하는 POL-XXX 모두 커버
- [ ] 정책서 미정 항목이 명시되거나 "현재 없음"
- [ ] (workType=update) 변경 이력 1행 이상 (분기 B 코드베이스 산출 시 첫 행 `최초 작성`)
- [ ] (workType=update) provenance — 헤더 "이전 버전" + 변경 이력 `참고본`이 `references/state-schema.md §6` 표와 일치 (referenceWork 번호 / `코드베이스: <경로>` / `—`)

## 5. publish

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "draw-ui-flow"
  markdown: <본문>
```

## 6. 종료 안내

```
UI 흐름도 작성 완료. 다음 권장 단계: 데이터 흐름도.
새 세션에서 /yeoboya-select-subtask을 호출하세요.
```
