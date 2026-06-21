---
name: yeoboya-draw-ui-flow
description: "Use ONLY when yeoboya-route-work triggers this work-list item. NEVER invoke directly. Defines screens with unique IDs, user actions with unique IDs per screen, and the screen-transition diagram. Self-validates that every screen-action pair has an ID (used by draw-data-flow for ID-based linking). Publishes Notion page titled 'UI 흐름도'."
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

## 3. 작성 절차

1. **컨텍스트 분할** — 정책서/도메인 명세서를 읽고 화면이 등장하는 도메인 영역을 컨텍스트로 분할. 컨텍스트가 N개면 §0에 라벨 N개.
2. **역할 매핑** — 정책서 §역할의 한국어 명칭을 그대로 사용. 화면 ID에 쓰기 위한 영문/공백제거 형태가 필요하면 §0에 mapping 명시.
3. **화면 ID 부여** — 패턴 `<컨텍스트>_<역할>_NN` (NN은 역할별 01부터 2자리 패딩). 화면을 §1에 표로 등록.
4. **액션 ID 부여** — 패턴 `<역할>:Action:N` (역할별 1부터 증가). 액션의 단계명과 발생 화면 ID를 §2에 표로 등록.
5. **다이어그램 작성** — 역할별로 Mermaid flowchart TD 작성. 색상 범례 4종(error/unclear/auth/system) 일관 적용.
6. **정책 인용 주석 표** — 다이어그램 강조 영역(트리거, 게이트, 토스트 등)에 대해 POL-XXX 출처 + 원문 인용.
7. **UI 상태 표** — 각 화면의 상태값(정상/임박/종료/숨김 등) 정리.
8. **화면 전환 관계 표** — From/To/액션 ID/진입 조건/트리거/뒤로가기 6열.
9. **엣지 케이스 표** — 카테고리/대상 ID/트리거/표현/복귀 경로/정책 출처 6열.
10. **정책서 미정 항목** — 회의 결정 필요한 unclear 노드 목록.

본문 구조는 `references/ui-flow-template.md`를 직접 따른다.

## 4. Self-validation (publish 직전)

- [ ] 페이지 제목 = "UI 흐름도"
- [ ] 정책 SOT + 도메인 SOT link 둘 다 footnote에 존재
- [ ] §0 컨텍스트 라벨이 모두 정의되어 있음
- [ ] §0 역할 라벨이 정책서 §역할 명칭과 일치 (또는 mapping 명시)
- [ ] §1 화면 ID는 `<컨텍스트>_<역할>_NN` 패턴 + 전역 unique
- [ ] §2 액션 ID는 `<역할>:Action:N` 패턴 + 역할별 unique
- [ ] §2의 모든 `발생 화면 ID`가 §1에 존재
- [ ] §3 다이어그램에 §1의 모든 화면 등장 (또는 명시적 제외 사유)
- [ ] §3 다이어그램에 4종 classDef(error/unclear/auth/system) 모두 정의
- [ ] §3 정책 인용 주석 표가 다이어그램에 등장하는 POL-XXX 모두 커버
- [ ] §5 전환 표의 모든 `액션 ID`가 §2에 존재 (시스템 트리거는 액션 ID 비움 허용)
- [ ] §5 전환 표의 모든 `From ID`·`To ID`가 §1에 존재
- [ ] §6 엣지 케이스의 `대상 ID`가 §1 화면 ID 또는 §2 액션 ID에 존재
- [ ] §정책서 미정 항목이 명시되거나 "현재 없음"

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
새 세션에서 /yeoboya-route-work을 호출하세요.
```
