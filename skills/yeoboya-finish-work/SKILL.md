---
name: yeoboya-finish-work
description: "Use ONLY when yeoboya-route-work triggers this 작업 종결 work-list item. NEVER invoke directly. Verifies git log commit-pattern compliance, reports which deliverables exist in work.json.links, toggles workspace.platform-matching iOS_완료/Android_완료 boolean on the work DB row, prints a closing report. Does not publish new pages, writes nothing to work.json, and does not touch 작업 상태."
user-invocable: false
---

# yeoboya-finish-work

작업 종결 검증 + 보고.

## 1. 전제

- 선행 stage 발행 여부를 확인하되, 미완료 stage가 있어도 hard 종료하지 않는다 — 보고에 ⚠ 표시 후 계속 진행.
- finish-work는 언제든 실행할 수 있다.

## 2. git 검증

```
git log --grep='\[<작업번호>\]' --oneline
```

각 커밋에 대해 메시지 표준 패턴 검사:
- `[<작업번호>] [<phase>] ...` (write-code phase 커밋)
- `[<작업번호>] fix: ...` (fix-bug)
- `[<작업번호>] [qa-fix] ...` (fix-qa-bug)

위반 커밋이 있으면 보고에 ⚠ 마커.

## 3. Notion 발행 상태 보고

`work.json.links`에 기록된 산출물 항목을 나열한다. 선행조건·필수 집합 개념은 없으므로, 기록되지 않은 항목은 경고가 아니라 단순 "미발행"으로 표시한다.

## 4. Notion 작업 DB row 종결 처리

**본인 플랫폼 완료 토글**

`workspace.platform` 확인 후 본인 플랫폼만 토글:

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "finish-work"
  markdown: ""
  properties:
    iOS_완료: true       # workspace.platform === "iOS"일 때만 포함
    Android_완료: true   # workspace.platform === "Android"일 때만 포함
```

두 boolean 모두 본인 플랫폼만 토글한다. 다른 플랫폼의 boolean은 건드리지 않는다 — 다른 플랫폼 작업자가 자기 finish-work에서 자기 boolean을 켤 책임.

## 5. 종결 보고 출력

```
[<작업번호>] <작업명> — <workType 한국어 라벨> 종결 보고

▸ 커밋: <N>개 ✓
▸ Notion 발행 (work.json.links 기준):
    ✓ 기획서 검토 (pageId: ...)
    ✓ 정책서
    ✓ 도메인 명세서
      UI 흐름도 (미발행)
    ✓ 데이터 흐름도 · 통신 명세서
    ✓ QA 시나리오
▸ 코드 작성 phase:
    ✓ data
    ✓ domain
    ✓ presentation
▸ 경고: <0 또는 ⚠ 항목>

작업이 종결되었습니다.
```

## 6. Self-validation

- [ ] §2 git 검증 결과가 보고에 포함
- [ ] §3 Notion 발행 상태가 보고에 포함
- [ ] ⚠ 항목이 있으면 보고에 명시적 표시
- [ ] workspace.platform이 iOS면 iOS_완료=true 호출, Android면 Android_완료=true 호출
