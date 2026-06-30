---
name: yeoboya-create-work
description: "사용자가 /yeoboya-create-work <작업번호>를 호출하거나, 이 코드베이스에 새 feature/update/bugfix 작업을 만들려는 의도를 표현할 때('새 작업 시작', '기능 추가 시작', '버그 수정 작업 시작') 사용한다. 새 작업을 부트스트랩한다: 워크스페이스를 검증하고, workType을 명시적으로 묻고(추론 금지), .workflow/<작업번호>/work.json을 links: {} (빈 값)으로 생성하며, yeoboya-publish-notion을 통해 Notion 작업 DB row를 등록/갱신한다. workType은 절대 추론하지 말고 항상 묻는다. 병렬 작업은 항상 허용하며, 기존 work.json은 동일한 작업번호가 재사용될 때만 안전 게이트를 발동한다."
---

# yeoboya-create-work

새 작업 부트스트랩. workType은 사용자가 명시 선택 (추론 금지).

## 1. 입력 검증

- `<작업번호>` 형식 검증: 정규식 `^[A-Z]+-\d+$` (예: DCL-1234, AID-99). 실패 시 형식 안내 후 종료
- `.workflow/workspace.json` 존재 확인. 없으면 "/yeoboya-setup-workspace를 먼저 실행하세요" 안내 후 종료

## 2. 같은 작업번호 안전 게이트

`.workflow/<작업번호>/work.json`이 존재하면 사용자에게 명시 게이트:

```
이 작업번호로 진행 중인 work.json이 있습니다. 새로 시작하면 기존 진행 상태가 덮어써집니다.
재개하시려면 /yeoboya-select-subtask을 사용하세요.
그래도 새로 시작하시겠습니까? (네 / 아니요)
```

"네" 외 응답 → 종료. 다른 작업번호의 진행 중 작업이 있어도 *병렬 작업을 허용* — 별도 게이트 없음.

## 3. workType 게이트 (명시 질문)

```
작업 유형을 선택하세요:
  - 기능 추가 (feature)
  - 기능 수정 (update)
  - 버그 수정 (bugfix)
```

문자열 매칭 — "feature", "기능 추가", "추가" 등 일반 동의어 허용. 모호하면 재질문.

선택된 workType은 work.json에 영문 키(`feature`/`update`/`bugfix`)로 저장한다. Notion `작업 유형` select 값 변환(`신규 개발`/`변경/고도화`/`버그 수정`)은 publish-notion이 `WORKTYPE_LABEL` (state-schema.md §4) lookup으로 수행 — 본 skill이 한국어 라벨을 만들지 않는다. workType은 라벨·세부작업 뷰 분기·update 수정 동작(state-schema §6)에 쓰일 뿐, 순차 단계 집합(pipeline)은 결정하지 않는다.

## 4. 작업명 입력

```
작업명을 입력해주세요 (예: "라이브 방송 검색 기능"):
```

## 5. workType=update 전용: referenceWork 게이트

```
참고할 기존 feature 작업이 있나요?
  - 있음 → 참고 작업번호 입력 (예: DCL-1230)
  - 없음 → 독립 신규로 진행
```

참고 작업번호 입력 시 형식 검증. 선택한 경우 `referenceWork` 필드로 저장.

## 6. work.json 초기화

작성:

```json
{
  "work": "<작업번호>",
  "workType": "<feature|update|bugfix>",
  "name": "<작업명>",
  "referenceWork": "<update + 선택 시만>",
  "codeWriteDone": false,
  "codeReviewDone": false,
  "links": {}
}
```

`.workflow/<작업번호>/work.json`에 쓰기.

`referenceWork` 키는 workType=update 이고 사용자가 참고 작업번호를 선택했을 때만 포함한다. `links`는 항상 빈 객체 `{}`로 초기화한다.

## 7. Notion 작업 DB row 등록

`yeoboya-publish-notion` 호출 (mode="sync" → 후속 dispatch 또는 sync-only):

1. **sync로 row 존재 확인** — `{ rowId, workType, 작업명, 도메인, 담당자[], iOS_완료, Android_완료 }` 수신
2. **분기:**
   - row 없음 → `publish-notion mode="dispatch"`로 신규 row 생성. properties:
     - `workType: <workType>` (publish-notion이 WORKTYPE_LABEL로 변환)
     - `작업명: <name>`
     - `도메인: <사용자 입력 또는 생략>` (생략 시 Notion에서 수동 설정)
     - `담당자: { mode: "append", urls: [<workspace.notion.workerPageId 정규화>] }`
   - row 있음 → `publish-notion mode="dispatch"`로 row update. properties는 위와 동일하되:
     - `작업명`은 기존 값 우선 (이미 있으면 덮어쓰지 않음)
     - `도메인`은 기존 값 우선
     - `담당자`만 본인 추가 (publish-notion이 append union)
3. **도메인 추출**: sync 결과의 `도메인` 사용. 비어 있고 사용자가 입력했으면 위 properties에 포함. 끝까지 비어 있으면 그대로 진행 (강제 안 함).
4. Notion DB 데이터소스는 `workspace.json`의 `notion.workDbDataSourceUrl` 사용.

`작업 상태` 자동 설정 **없음** — Notion 작업 상태는 본 skill이 변경하지 않는다.

작업 일정, iOS/Android 완료는 본 skill에서 **다루지 않는다**.

## 8. activeWork 갱신

`.workflow/workspace.json`의 `activeWork` 필드를 `<작업번호>`로 갱신.

## 9. 종료 안내

```
작업 부트스트랩 완료: <작업번호> · <workType 한국어 라벨>
다음 단계 진행은 새 세션에서 /yeoboya-select-subtask을 호출하세요.
```

자동 라우팅 trigger **없음** — 사용자가 명시적으로 새 세션 + select-subtask으로 진행.

기존 progress.json 기반 작업은 자동 마이그레이션되지 않습니다 — 필요 시 재생성.

## 10. Self-validation

work.json 저장 직전 검증:
- `work` 필드가 `^[A-Z]+-\d+$` 형식과 일치
- `workType ∈ {feature, update, bugfix}`
- `codeWriteDone`이 `false`와 정확히 일치 (초기화 직후)
- `codeReviewDone`이 `false`와 정확히 일치 (초기화 직후)
- `links`가 빈 객체 `{}`와 정확히 일치 (deep-equal)
- `referenceWork`는 workType=update 이고 사용자가 선택한 경우에만 존재
