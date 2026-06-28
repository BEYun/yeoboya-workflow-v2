---
name: yeoboya-write-qa
description: "yeoboya-select-subtask이 이 세부 작업을 trigger할 때만 사용한다. 직접 호출 금지. 이전 산출물(UI 흐름도, 데이터 흐름도, write-code 커밋)로부터 QA 시나리오를 도출한다: 골든 패스, 엣지 케이스, 회귀. 자체 검증한 뒤 'Notion QA 시나리오'를 게시한다."
user-invocable: false
---

# yeoboya-write-qa

QA 시나리오 작성.

## 1. 전제

- work.json 존재.
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회 호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다 — (a) 다른 작업자가 만든 선행 문서를 links에서 인식, (b) 본 산출물이 이미 있으면 publish가 update가 되어 중복 페이지 방지.

## 2. 입력 fetch

- UI 흐름도 (액션 ID 추출)
- 데이터 흐름도 (API/Socket 명세)
- write-code 또는 fix-bug 커밋 (`git log --grep='[<작업번호>]'`)

## 3. 작성 절차

본문 구조:

```
# QA 시나리오

## 1. 케이스 매트릭스
| 케이스 ID | 종류 | UI 액션 ID | 검증 항목 | 기대 결과 |
|---|---|---|---|---|
| QA-001 | golden | A-001 | 정상 로그인 | 홈 화면 진입 |
| QA-002 | edge | A-001 | 빈 비밀번호 | 입력 검증 에러 |
| QA-003 | regression | A-002 | 검색 후 뒤로가기 | 검색 결과 보존 |

## 2. 케이스별 상세
### QA-001
- 사전 조건: ...
- 단계: ...
- 통과 기준: ...

(각 케이스마다 반복)
```

종류: `golden` (정상 경로), `edge` (경계/예외), `regression` (회귀 — 기존 기능 영향 확인).

## 4. Self-validation (publish 직전)

- [ ] §1 매트릭스에 각 종류(golden/edge/regression)별 최소 1개
- [ ] §1 모든 UI 액션 ID가 UI 흐름도 §2에 존재
- [ ] §2 모든 케이스 ID가 §1에 등장
- [ ] 케이스 ID 유일 (`QA-NNN` 패턴)

## 5. publish

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "write-qa"
  markdown: <본문>
```

## 6. 종료 안내

```
QA 시나리오 작성 완료. 다음 권장 단계: QA 버그 수정 (발견된 게 있다면) 또는 작업 종결.
새 세션에서 /yeoboya-select-subtask을 호출하세요.
```
