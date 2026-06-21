---
name: yeoboya-route-work
description: "Use when the user invokes /yeoboya-route-work, or expresses intent to open the work-list or run an operation ('작업 진행', '작업목록', '다음 작업'). Scans .workflow/ for work items (each has a work.json), lets the user pick one (activeWork marked [현재]), then shows the FULL work-list grouped by phase with no recommendation and triggers the chosen yeoboya-<key> skill via the Skill tool. Includes the write-code warning gate before committing to implementation."
user-invocable: true
---

# yeoboya-route-work

작업 선택 + 전체 작업목록 표시 + Skill 도구로 trigger.

## 1. 작업 목록 스캔

`.workflow/` 디렉토리를 스캔하여 `work.json`이 있는 모든 작업 폴더를 수집:

```
진행 중 작업 목록:
  - [DCL-1234] 라이브 방송 검색 — 기능 추가 [현재]
  - [DCL-1245] 클럽 입장 시 알림 — 버그 수정

어느 작업을 진행하시겠어요? 작업번호를 입력하세요.
```

`[현재]` 마커는 `workspace.json`의 `activeWork`와 일치하는 작업에 부착. 목록이 비어 있으면 안내 후 종료. 작업번호가 1개뿐이면 자동 선택 (안내만 출력).

## 2. activeWork 갱신

사용자 선택 → `workspace.json`의 `activeWork` 필드를 선택된 작업번호로 갱신.

## 3. 작업목록 표시

`references/state-schema.md §4`의 `WORK_GROUPS` 순서로 전체 11개 항목을 표시. 마커 규칙:

| 조건 | 마커 |
|---|---|
| `work.json.links`에 해당 키 존재 | ✓ |
| 그 외 | (공백) |

추천 마커(▶)는 없다. 모든 항목은 동등하게 나열된다.

예시:
```
[DCL-1234 · 라이브 방송 검색 · 기능 추가]

작업목록 (원하는 항목을 선택하세요):
  ◆ 기획
    ✓ 기획서 검토
      정책서 작성
  ◆ 설계
      도메인 명세서
      UI 흐름도
    ✓ 데이터 흐름도
  ◆ 개발
      코드 작성
      버그 수정
      코드 리뷰
  ◆ 테스트
      QA 시나리오
      QA 버그 수정
  ◆ 종결
      작업 종결
```

키·라벨 매핑은 `references/state-schema.md §4`의 `WORK_LABELS` 참조.

## 4. 메뉴 (자연어 응답)

"진행할 항목 이름을 입력하세요 (종료: '취소')."

항목 이름은 `WORK_LABELS`의 한국어 라벨 또는 키(예: `write-policy`) 모두 매칭. **단축키(y/s/n) 사용 금지.**

## 5. 응답 분기

| 응답 | 동작 |
|---|---|
| 항목 이름 (`links`에 없음) | 해당 항목 trigger (§6 게이트 → §7) |
| 항목 이름 (`links`에 이미 존재) | "이 항목은 이미 Notion 페이지가 있습니다. 다시 실행하면 기존 페이지를 갱신합니다. 진행할까요? (네/아니요)" → "네"면 trigger |
| "취소" / "종료" | 종료 |

**작업 종결 전용 선행 확인** (항목 이름 매칭 후, trigger 전):

`work.json.reviewDone`을 확인한다.
- `false`이면 즉시 하드 블록:
  ```
  코드 리뷰가 완료되지 않았습니다. 코드 리뷰(review-code)를 먼저 진행해 주세요.
  ```
  메뉴(§4)로 복귀. "네/아니요" 게이트 없음.
- `true`이면 기존 흐름대로 trigger.

이 블록은 write-code 경고 게이트(§6)와 달리 하드 블록이다.

## 6. write-code 진입 경고 게이트 (대상이 `write-code`일 때만)

trigger 직전 항상 안내 (이전 항목 실행 여부는 확인하지 않는다):

```
코드 작성은 기획·설계 산출물이 확정된 뒤 진행하길 권장합니다.
되돌리려면 추가 작업이 필요합니다. 진행하시겠어요?
```

"네" 외 응답 → §4 메뉴로 복귀.

## 7. 항목 trigger

Skill 도구로 해당 `yeoboya-<key>` skill 호출. 전달 컨텍스트:

- `work` (작업번호)
- `workType`
- 필요 시 `referenceWork`

## 8. 항목 완료 후 종료

trigger된 skill이 완료 안내를 출력하면 본 skill은 **반복하지 않고 즉시 종료**. 사용자는 새 세션에서 `/yeoboya-route-work`를 다시 호출.

## 9. Self-validation

trigger 전: 선택한 키가 `references/state-schema.md §4`의 `WORK_LIST`에 속하는지 검증. (workType 단계 필터·옵션 게이트 검증은 없음.)
