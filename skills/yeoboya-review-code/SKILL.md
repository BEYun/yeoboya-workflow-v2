---
name: yeoboya-review-code
description: "Use ONLY when yeoboya-route-work triggers this work-list item. NEVER invoke directly. Collects work-related diff via `git log --grep='[<작업번호>]'`, dispatches code-reviewer subagent for findings, lets user decide fix-or-pass per finding. Output: review markdown + (optional) Notion page. Notion publish is optional."
user-invocable: false
---

# yeoboya-review-code

작업번호 관련 diff의 코드 리뷰.

## 1. 전제

- work.json 존재.
- 리뷰 대상 코드(git 커밋)가 있으면 진행한다.

## 2. diff 수집

```
git log --grep='\[<작업번호>\]' --oneline
git diff <첫 커밋>^..<마지막 커밋>
```

수집된 diff 요약을 사용자에게 노출 (그라운딩).

## 3. subagent 호출

`agents/code-reviewer.md` subagent에게 위임. 응답으로 리뷰 산출물 (마크다운) 수신.

## 4. 사용자 결정 게이트

리뷰 산출물의 각 발견 사항마다:
- **수정** → 작은 수정 직접 적용 후 커밋. 큰 수정이면 "변경점 phase 재실행 권장" 안내 후 route-work 복귀
- **수용** → 리뷰 산출물에 "수용" 표시
- **반박** → 사용자가 이유 작성, 산출물에 "반박" 표시

## 5. Self-validation (publish 옵션이면)

- [ ] 리뷰 산출물에 모든 발견 사항이 표 형태로 정리
- [ ] 각 발견 사항에 결정 (수정/수용/반박) 라벨

## 6. publish (옵션)

리뷰 산출물을 Notion으로 발행하려면:
```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "review-code"
  title: "코드 리뷰 — <작업번호>"
  markdown: <리뷰 산출물>
```
단, review-code는 `TITLE_TO_KEY`에 매핑이 없어 publish해도 hook이 work.json.links에 자동 기록하지 않는다.

## 7. 종료 안내

리뷰 종료 후:

```
코드 리뷰 완료. 다음 권장 단계: QA 시나리오.
새 세션에서 /yeoboya-route-work을 호출하세요.
```
