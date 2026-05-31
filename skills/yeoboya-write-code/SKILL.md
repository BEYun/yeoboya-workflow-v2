---
name: yeoboya-write-code
description: "Use ONLY when yeoboya-continue-work triggers this skill for workType=feature/update after draw-data-flow (or for re-execution targeting a specific phase). NEVER invoke directly. Internally runs: brainstorming → Phase plan (Data/Domain/Presentation) → single phase execution per session + review → optional re-run of specific phase only. Tracks phase progress in .workflow/<task>/code-phases.json. progress.stages.write-code.status flips to done only when all three phases are done. Does NOT call yeoboya-publish-notion — output is git commits, not Notion pages."
user-invocable: false
---

# yeoboya-write-code

v1 `code-plan + layer-*` 통합. 내부에 brainstorming + Phase plan + 세션별 실행.

## 1. 전제

- `stages.draw-data-flow.status` ∈ {`done`, `published`, `skipped`}
- workType ∈ {`feature`, `update`}
- continue-work이 **write-code 진입 게이트**를 이미 통과 (사용자가 명시 확인)

## 2. 첫 호출 vs 재호출 분기

`.workflow/<task>/code-phases.json` 존재 여부로 분기:

| 상태 | 분기 |
|---|---|
| 부재 | **첫 호출** — Brainstorming → Phase plan 작성 → Phase 선택 게이트 |
| 존재 | **재호출** — 어느 phase를 실행할지 사용자 선택 게이트 |

## 3. 첫 호출 흐름

### 3.1 Brainstorming
정책서/도메인/UI/데이터 흐름도 fetch → 사용자와 함께 구현 접근법 논의:
- 데이터 흐름도의 API/Socket을 어떤 클라이언트 모듈에 매핑할지
- 도메인 명세서의 엔티티/규칙을 어떤 use case로 표현할지
- UI 흐름도의 화면을 어떤 view model로 분리할지

(superpowers의 brainstorming skill을 활용 가능 — 단 호출 명시.)

### 3.2 Phase plan 작성
`.workflow/<task>/plans/` 디렉토리 생성. 3개 phase plan 파일 작성:

- `data-phase.md` — Data layer (모델, 영속성, repository 구현, DTO)
- `domain-phase.md` — Domain layer (use case, business rule, 도메인 서비스)
- `presentation-phase.md` — Presentation layer (view model, view, 라우팅, 사용자 액션 처리)

각 phase plan은 다음을 포함:
- 변경/추가할 파일 목록 (정확한 경로)
- 각 파일의 책임 한 줄
- 테스트 계획
- 커밋 단위 (TDD 권장)

### 3.3 code-phases.json 초기화

```json
{
  "currentPhase": "data",
  "phases": {
    "data":         { "status": "todo" },
    "domain":       { "status": "todo" },
    "presentation": { "status": "todo" }
  }
}
```

### 3.4 Phase 선택 게이트

```
Phase plan 작성 완료. 어느 phase부터 진행하시겠어요?
  - 데이터 (data) ← 권장 (Data → Domain → Presentation 순서)
  - 도메인 (domain)
  - 프레젠테이션 (presentation)
  - 취소 (이번 세션에서 phase 실행 안 함)
```

권장은 data → domain → presentation. 단 사용자 선택 자유.

## 4. 재호출 흐름

`code-phases.json` 읽고 진행 표시:

```
[코드 작성 진행 상황]
  ✓ 데이터 (data)
  ▶ 도메인 (domain)     ← 다음 권장
    프레젠테이션 (presentation)

어느 phase를 실행하시겠어요? phase 이름을 입력하거나, '취소' 입력.
```

완료된 phase 재선택 시 "이미 완료. 변경점 반영을 위해 재실행하시겠어요?" 게이트. 후행 phase 자동 리셋 **없음**.

## 5. Phase 실행 (한 세션, 한 phase)

선택된 phase의 plan 파일 (`.workflow/<task>/plans/<phase>-phase.md`)을 따라 코드 작성:

1. TDD: 실패하는 테스트 작성 → 구현 → 테스트 통과 → 커밋
2. 커밋 메시지: `[<작업번호>] [<phase>] <변경 요약>` (예: `[DCL-1234] [domain] LiveSearchUseCase 추가`)
3. Phase 내부에서 자체 review (변경 파일 일관성, 테스트 커버리지, 도메인/데이터 흐름도와의 일치)
4. Phase 종료 시 `code-phases.json` 업데이트: `phases.<phase>.status = "done"`

superpowers의 `test-driven-development` skill을 활용 가능.

## 6. write-code 종료 조건

3개 phase 모두 `done`일 때:
- `progress.stages.write-code.status = "done"` 업데이트
- 종료 안내:
  ```
  코드 작성 완료 (data / domain / presentation 모두 완료).
  다음 권장 단계: 코드 리뷰.
  새 세션에서 /yeoboya-continue-work을 호출하세요.
  ```

3개 phase 중 일부만 완료일 때:
- `progress.stages.write-code.status`는 `"todo"` 유지 (또는 `"in-progress"` — writing-plans 단계에서 결정한 별도 표시값 도입 시)
- 종료 안내:
  ```
  <phase> phase 완료. 남은 phase: <목록>.
  새 세션에서 /yeoboya-continue-work을 호출하면 다음 phase를 진행할 수 있습니다.
  ```

## 7. Self-validation

phase 완료 시점에 검증:
- [ ] phase plan 파일과 실제 커밋 변경 파일이 합치
- [ ] 커밋 메시지가 표준 패턴 (`[<task>] [<phase>] ...`) 준수
- [ ] phase 관련 신규/변경 파일에 대응 테스트 존재 (또는 사용자가 "테스트 불필요" 명시)
