---
name: yeoboya-write-code
description: "Use ONLY when yeoboya-route-work triggers this work-list item (or for re-execution targeting a specific phase). NEVER invoke directly. On first call: reads prior Notion deliverables, derives N architectural phases via brainstorming, writes .workflow/<작업번호>/phases/<phase명>.md per phase, initializes code-phases.json with dynamic keys. On resume: reads code-phases.json, lets user pick a phase. Executes one phase per session (TDD). Does NOT call yeoboya-publish-notion."
user-invocable: false
---

# yeoboya-write-code

v1 `code-plan + layer-*` 통합. 내부에 brainstorming + Phase Derivation + 세션별 실행.

## 1. 전제

- work.json 존재.
- route-work이 **write-code 진입 게이트(§6)**를 이미 통과: sync-links로 `work.json.links`가 최신화되었고, **feature는 정책서·UI 흐름도·데이터 흐름도 3종이 links에 존재함이 보장된다(하드 선행조건)**. update/bugfix는 일부가 없을 수 있다.
- 선행 산출물(work.json.links의 정책서·도메인 명세서·데이터 흐름도 등 존재하는 것)을 Brainstorming 입력으로 fetch한다.

## 2. 첫 호출 vs 재호출 분기

`.workflow/<작업번호>/code-phases.json` 존재 여부로 분기:

| 상태 | 분기 |
|---|---|
| 부재 | **첫 호출** — Brainstorming → Phase Derivation → Phase 선택 게이트 |
| 존재 | **재호출** — 어느 phase를 실행할지 사용자 선택 게이트 |

## 3. 첫 호출 흐름

### 3.1 Brainstorming (Phase Derivation)

선행 산출물 fetch:
- `work.json.links`에 pageId가 있는 항목을 Notion MCP로 읽는다 (write-policy, write-domain, draw-data-flow 등 실행된 것만).
- `work.json.workType`, `name` 확인.

선행 산출물을 바탕으로 이 작업에 필요한 아키텍처 분해를 결정한다:
- Phase 이름은 자유형식. 작업 성격에 맞게 명명 (예: `api-client`, `repository`, `view-model`, `ui` / 또는 `use-case`, `screen` 등).
- 고정 개수 강제 없음. 선행 산출물이 없으면 작업명만으로 추론.
- 사용자와 phase 구성을 확인한 뒤 확정한다.

(superpowers:brainstorming skill 활용 가능 — 단 호출 명시.)

### 3.2 Phase spec 파일 작성

`.workflow/<작업번호>/phases/` 디렉토리 생성. 확정된 각 phase마다 `<phase명>.md` 생성:

```markdown
# <phase명>

## 범위
이 phase에서 다룰 파일 / 모듈 / 책임 범위

## 다른 phase와의 인터페이스
의존 방향, 공유 타입, 호출 계약

## 구현 노트
핵심 패턴, 제약사항, 주의점
```

### 3.3 code-phases.json 초기화

확정된 phase 목록으로 초기화 (예: 4개 phase인 경우):

```json
{
  "currentPhase": "<첫 번째 phase명>",
  "phases": {
    "api-client":  { "status": "todo" },
    "repository":  { "status": "todo" },
    "view-model":  { "status": "todo" },
    "ui":          { "status": "todo" }
  }
}
```

keys는 도출된 phase명. 순서는 phases 오브젝트에서 삽입 순서를 따른다.

### 3.4 Phase 선택 게이트

```
Phase 구성 완료:
  - api-client
  - repository
  - view-model
  - ui

어느 phase부터 진행하시겠어요? (권장: 첫 번째 phase부터 순서대로)
취소 → 이번 세션에서 phase 실행 안 함.
```

## 4. 재호출 흐름

`code-phases.json` 읽고 진행 표시:

```
[코드 작성 진행 상황]
  ✓ api-client
  ▶ repository     ← 다음 권장
    view-model
    ui

어느 phase를 실행하시겠어요? phase 이름을 입력하거나, '취소' 입력.
```

완료된 phase 재선택 시 "이미 완료. 변경점 반영을 위해 재실행하시겠어요?" 게이트. 후행 phase 자동 리셋 **없음**.

## 5. Phase 실행 (한 세션, 한 phase)

선택된 phase의 spec 파일 (`.workflow/<작업번호>/phases/<phase명>.md`)을 Read해서 구현 계획 파악:

1. TDD: 실패하는 테스트 작성 → 구현 → 테스트 통과 → 커밋
2. 커밋 메시지: `[<작업번호>] [<phase>] <변경 요약>` (예: `[DCL-1234] [view-model] LiveSearchViewModel 추가`)
3. Phase 내부에서 자체 review (변경 파일 일관성, 테스트 커버리지, 도메인/데이터 흐름도와의 일치)
4. Phase 종료 시 `code-phases.json` 업데이트: `phases.<phase>.status = "done"`

superpowers의 `test-driven-development` skill을 활용 가능.

## 6. write-code 종료 조건

모든 phase가 `done`일 때:
- 종료 안내:
  ```
  코드 작성 완료 (모든 phase 완료).
  다음 권장 단계: 코드 리뷰.
  새 세션에서 /yeoboya-route-work을 호출하세요.
  ```

일부 phase만 완료일 때:
- 종료 안내:
  ```
  <phase> phase 완료. 남은 phase: <목록>.
  새 세션에서 /yeoboya-route-work을 호출하면 다음 phase를 진행할 수 있습니다.
  ```

## 7. Self-validation

phase 완료 시점에 검증:
- [ ] phase spec 파일과 실제 커밋 변경 파일이 일치
- [ ] 커밋 메시지가 표준 패턴 (`[<작업번호>] [<phase>] ...`) 준수
- [ ] phase 관련 신규/변경 파일에 대응 테스트 존재 (또는 사용자가 "테스트 불필요" 명시)
