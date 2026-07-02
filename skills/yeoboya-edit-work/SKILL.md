---
name: yeoboya-edit-work
description: "사용자가 /yeoboya-edit-work를 호출하거나, 작업 진행 중 정책·흐름·명세가 바뀌었다고 알릴 때('정책이 바뀌었어', '흐름도 수정됐어', '명세 변경됐어', '이 내용 반영해줘', '변경 전파') 사용한다. 진행 중인 작업(activeWork)에 대해 변경 내용을 받아 정책서~QA 시나리오 중 영향 범위를 판단해 사용자에게 검토받고, 영향 문서를 의존 순서로 기존 문서 스킬을 재사용해 갱신하며, 코드가 영향받으면 write-code 경유로 재작성을 위임한다. 세부작업이 아니며 select-subtask 흐름 밖의 독립 도구다. 변경이 문서 하나라도 건드릴 수 있으면 임의 판단으로 넘기지 말고 이 스킬을 사용한다."
user-invocable: true
---

# yeoboya-edit-work — 변경 전파 (문서~코드)

작업 도중 바뀐 정책·흐름·명세를 **영향 범위 판단 → 문서 순차 갱신 → 코드 재작성 위임**으로 전파한다.
기존 산출물을 수정하는 오케스트레이터이며, 각 문서 갱신·코드 구현은 기존 스킬(`yeoboya-write-*`,
`yeoboya-draw-*`, `yeoboya-write-code`)에 위임한다. (설계: `docs/superpowers/specs/2026-07-02-edit-work-change-propagation-design.md`)

## 1. 전제 / 진입

- `.workflow/workspace.json` 존재. `activeWork`로 대상 작업을 확정한다. 없거나 여러 작업 중
  고를 필요가 있으면 `.workflow/`를 스캔해 사용자에게 고르게 한다(select-subtask §1 패턴).
  작업이 하나도 없으면 안내 후 종료.
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회
  호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다. 전파 판단이 **최신 문서 존재 상태**
  에서 시작하도록 하기 위함이다(다른 작업자가 만든 선행 문서도 인식).

## 2. 변경 내용 수집

사용자에게 무엇이 어떻게 바뀌었는지 받는다.

- **필수**: 자유 서술 — 예) "검색 필터에 지역 조건 추가", "결제 실패 시 재시도 정책 삭제".
- **선택**: 갱신된 기획서 참조 — Notion 페이지 링크 또는 PDF 경로. 있으면 fetch해 판단 근거로 쓴다.

이 변경 서술을 **변경 델타**로 부르며, 이후 문서 스킬 trigger(§5)와 plan.md 재작성(§6)에 그대로 넘긴다.

## 3. 영향 범위 판단 (제안 → 확정)

1. **현재 산출물 파악**: `work.json.links`의 키(존재하는 문서) + `codeWriteDone`(코드 착수/완료 여부).
2. **workType-aware 의존 사슬**(`references/state-schema.md §4` `SUBTASK_GROUPS` 순서):
   - feature/update: 정책서 → 도메인 명세서 → UI 흐름도 → 데이터 흐름도 → QA 시나리오 → 코드
     (기획서 검토가 있고 기획서 자체가 바뀌었으면 정책서 앞에 포함)
   - bugfix: 버그 분석 → QA 시나리오 → 코드
3. **영향 범위 제안**: 변경 델타를 각 문서와 대조해 영향 여부와 **근거**를 표로 제시한다. 의존 사슬을
   고려하되 **비연속 선택 허용**(예: 데이터 흐름도 + QA만).
   ```
   변경: "검색 필터에 지역 조건 추가"

   | 문서          | 영향 | 근거                                         |
   |---------------|------|----------------------------------------------|
   | 정책서        | O    | 검색 조건 정의에 '지역' 규칙 추가            |
   | 도메인 명세서 | O    | SearchFilter 도메인에 region 속성 추가       |
   | UI 흐름도     | O    | 필터 화면에 지역 선택 액션 신설              |
   | 데이터 흐름도 | O    | /search 파라미터에 region 추가               |
   | QA 시나리오   | O    | 지역 필터 케이스 추가                        |
   | 코드          | O    | 위 델타 반영(기존 검색 구현 수정)            |

   이 범위로 진행할까요? 가감할 항목이 있으면 알려주세요.
   ```
4. **확정**: 사용자가 가감해 최종 범위를 확정한다. 확정 범위가 비면(갱신할 산출물 없음) 안내 후 종료.

## 4. 마찰 로그 기록 (spec-change)

범위 확정 직후, 문서 갱신(§5) 시작 **전 1회** 마찰 로그에 append한다. `/yeoboya-insights`가
스펙 변경 빈도(상류 기획 불안정성)를 볼 수 있게 하기 위함이다. (도구 결함이 아니라 개선 신호다.)

```bash
echo '{"category":"spec-change","skill":"yeoboya-edit-work","workNo":"<작업번호>","workType":"<workType>","severity":"friction","what":"<변경 델타 요약>","expected":"<확정 영향 문서 목록>","source":"agent"}' \
  | node ${CLAUDE_PLUGIN_ROOT}/hooks/friction-log.js
```

`source:"agent"`는 이미 이유(`what`)를 담아 남기는 기록이므로 Stop 시 재프롬프트(`friction-recover`)를
유발하지 않는다.

## 5. 문서 순차 갱신 (기존 스킬 재사용)

확정된 문서 범위를 **의존 순서**(§3의 사슬, `SUBTASK_GROUPS` 순서)로 정렬해 **상류부터** 처리한다.
각 문서마다 해당 `yeoboya-<key>` 스킬을 **Skill 도구로 trigger**하며 다음을 컨텍스트로 전달한다:

- `work`(작업번호), `workType`, **변경 델타**(§2), 필요 시 `referenceWork`
- **명시 지시**: "기존 `work.json.links[<key>]` 페이지를 `notion-fetch`해 **출발점**으로 삼고, 이번 변경
  델타만 반영하라. 전체 재작성이 아니라 **기존 문서 수정**이다." — 이 지시는 workType과 무관하게
  준다(feature 기본 경로가 신규 생성이어서 지시 없이는 기존 문서를 재생성할 수 있으므로).

각 문서 스킬은 자체 self-validation 후 `publish-notion`으로 republish하며, `notion-page-record` hook이
갱신 pageId를 `links`에 기록한다. **상류를 먼저 갱신**하므로 하류 스킬이 갱신된 상류를 fetch·반영한다(전파).

- 범위에 있으나 아직 없는 문서(예: QA 시나리오 미작성)를 사용자가 포함했으면, 그 스킬 trigger는
  기존 update가 아니라 신규 생성이 된다(정상).
- **문서 간 체크포인트**: 각 문서 갱신 후 다음으로 넘어가기 전 사용자에게 확인 기회를 준다.
  중간에 멈춰도 각 republish는 원자적이라 부분 완료가 안전하다(재호출 시 §1 sync로 이어감).

> 이 다중 문서 연쇄는 "세부작업 단위 세션 분리"의 **의도된 예외**다 — 조율된 전파가 이 스킬의 존재 이유다.

## 6. 코드 재작성 (write-code 경유 + 델타 프레이밍)

코드가 확정 범위에 있고 **코드 작업이 이미 착수됨**(`.workflow/<작업번호>/plan.md` 존재)일 때만 수행한다.
plan.md가 없으면(코드 미착수) 이 단계를 건너뛰고 "문서만 갱신됨 — 이후 코드 작성 시 갱신된 문서를
반영한다"고 안내한다(코드 플래그 미변경).

"기존 코드를 없애고 새로 짜는" 위험을 막기 위해, write-code에 넘기기 전 plan.md를 **수정 델타로
재프레이밍**한다.

### 6.1 plan.md 수정 델타 재작성

`.workflow/<작업번호>/plan.md`를 아래로 갈아끼운다(state-schema §2 고정 섹션 유지):

```markdown
## 요구사항
기존 구현된 <파일/모듈>의 동작에서 다음만 변경한다: <변경 델타>.
기존 코드를 유지하며 이 델타만 반영한다. 전체 재구현·광범위 재작성 금지.
(원본 요구: <원래 name/산출물 요약> — 맥락 참고용)

## 참고 코드
<@기존 구현 경로 — work가 처음부터 짜지 않고 읽고 고치도록 앵커>
<@하네스 모듈 CLAUDE.md>

## 완료기준
- [ ] <변경된 동작의 검증 기준>
- [ ] <기존 동작 회귀 스위트 — 델타가 기존 걸 깨지 않았는지>

## 플랫폼
<iOS | Android — workspace.platform 값 그대로>

## 커밋 규약
이 작업의 모든 커밋은 `[<작업번호>]` prefix로 시작한다.
```

⚠️ `## 완료기준`은 반드시 `- [ ]` 체크리스트로 쓴다(하네스 `require-completion-criteria` 훅 대응).
이 프레이밍이 3중 방어를 만든다: (1) 델타 지시, (2) 참고 코드 앵커, (3) 회귀 완료기준.

### 6.2 플래그 리셋

`.workflow/<작업번호>/work.json`을 Read →
- `codeWriteDone = false` (재작성 시작 — 완료 시 write-code가 다시 `true`로)
- `codeReviewDone = false` (기존 리뷰가 무효화됨)
- **`codeBaseSha`는 유지**(이 작업의 원본+델타 커밋이 하나의 리뷰/종결 단위)

→ Write.

### 6.3 write-code trigger

`yeoboya-write-code`를 Skill 도구로 trigger한다. plan.md가 존재하므로 write-code는 재개 분기(§4)로
델타 plan.md를 그대로 `work`에 넘긴다. `work`가 새 run으로 델타를 반영해 구현·검증한다.
- `work`가 이전 미완료 run을 발견하면 "재개/신규"를 묻는다 — 어느 쪽이든 델타 plan.md가 입력이다.
- `work` 완료 시 write-code가 `codeWriteDone=true`를 재기록한다(write-code §5.1).

## 7. Self-validation

- [ ] 진입 시 `sync-links`를 1회 실행했다(§1).
- [ ] 영향 범위를 근거와 함께 제시하고 **사용자 확정**을 받았다(§3). 추천·자동 확정 아님.
- [ ] 확정 직후 마찰 로그를 `spec-change`로 1회 남겼다(§4).
- [ ] 문서 갱신을 **의존 순서(상류→하류)**로 했고, 각 trigger에 "기존 페이지 출발점 + 델타만 반영" 지시를 넣었다(§5).
- [ ] 코드가 범위이고 plan.md가 있을 때만 §6을 수행했고, plan.md 델타 프레이밍 + 플래그 리셋(`codeWriteDone`/`codeReviewDone=false`, `codeBaseSha` 유지)을 했다.

## 8. 종료 안내

```
변경 전파 완료.
- 갱신 문서: <목록>
- 코드 재작성: <write-code 위임함 / 미착수라 건너뜀 / 범위 아님>
컨텍스트 정리를 위해 새 세션에서 /yeoboya-select-subtask을 호출하세요.
```

코드 재작성이 도중 중단(harness-check 사람 게이트, bug-fix 한도 등)되면 write-code/work의 보고를
그대로 전달하고, 재개는 `/yeoboya-select-subtask → 코드 작성`으로 안내한다.

## 원칙

- 이 스킬은 **오케스트레이터**다 — 문서 본문 작성·코드 구현을 직접 하지 않고 기존 스킬에 위임한다.
- 산출물 SOT는 Notion(문서)·하네스 run(코드 진행)이며, edit-work는 `links`/플래그/plan.md만 조율한다.
- 영향 범위는 항상 사용자 확정을 거친다. 임의로 문서를 갱신하거나 코드를 재작성하지 않는다.
