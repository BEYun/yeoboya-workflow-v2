---
name: yeoboya-review-code
description: "yeoboya-select-subtask이 이 세부 작업을 trigger할 때만 사용한다. 직접 호출 금지. `git log --grep='[<작업번호>]'`로 작업 관련 diff를 수집하고, code-reviewer 서브에이전트를 디스패치해 발견사항을 도출하며, 발견사항마다 사용자가 수정-또는-통과를 결정하게 한다. 출력: 리뷰 markdown + (선택) Notion 페이지. Notion 게시는 선택사항이다."
user-invocable: false
---

# yeoboya-review-code

작업번호 관련 diff의 코드 리뷰.

## 1. 전제

- work.json 존재.
- `work.json.codeWriteDone === true` 전제 — select-subtask이 review-code 진입 시 하드 게이트로 보장한다(없으면 진입 차단). 본 스킬은 별도로 재확인하지 않는다.
- 리뷰 대상 코드(git 커밋)가 있으면 진행한다.
- `work.json.codeBaseSha`(write-code가 하네스 work 호출 직전 기록한 코드 시작 SHA)를 §2 diff 수집의 기준점으로 쓴다. 없거나 `null`이면 legacy 경로(`git log --grep`)로 대체한다.

## 2. diff 수집

`work.json.codeBaseSha`를 읽어 **range**로 수집한다(work이 작성한 커밋은 prefix가 빠져도 누락 없이 잡힌다 — 하이브리드 안전망):

```bash
BASE=$(jq -r '.codeBaseSha // empty' .workflow/<작업번호>/work.json)
if [ -n "$BASE" ]; then
  git log  "$BASE"..HEAD --oneline      # 이 작업 시작 이후 전부
  git diff "$BASE"..HEAD                # 리뷰 대상 diff
else
  # legacy fallback (codeBaseSha 없음)
  git log  --grep='\[<작업번호>\]' --oneline
  git diff <첫 커밋>^..<마지막 커밋>
fi
```

range 안에서 `[<작업번호>]` prefix가 없는 커밋은 **⚠로 표면화**한다(커밋 규약 위반 가시화 — 조용히 버리지 않음). 인터리브된 다른 작업의 커밋이면 사용자에게 이 작업 소속인지 확인받는다:

```bash
git log "$BASE"..HEAD --oneline | grep -v '\[<작업번호>\]'   # 있으면 ⚠ 보고
```

수집된 diff 요약을 사용자에게 노출 (그라운딩).

## 3. subagent 호출

`code-reviewer` 서브에이전트(`agents/code-reviewer.md`)에게 위임한다. 격리 검토자이므로 입력은 prompt에 직렬화한 payload만 사용한다 — 아래를 수집해 주입한다:

- `task`: work.json의 `name`·`workType`
- `diff`: §2에서 수집한 `files`·`fullDiff`
- `context.conventions`: 루트 `CLAUDE.md` + (변경 파일이 속한) 모듈 `CLAUDE.md`를 Read한 본문. 없으면 빈 값

응답으로 정형 마크다운 리뷰 산출물을 수신하고, `## 종합 판정`의 `status`(`pass | issues`) 토큰을 파싱해 §4로 넘긴다.

## 4. 사용자 결정 게이트

리뷰 산출물의 각 발견 사항마다:
- **수정** → 작은 수정 직접 적용 후 커밋. 큰 수정이면 select-subtask → write-code 재개로 안내(write-code가 하네스 `work`으로 재개 처리)
- **수용** → 리뷰 산출물에 "수용" 표시
- **반박** → 사용자가 이유 작성, 산출물에 "반박" 표시

## 5. Self-validation (publish 옵션이면)

- [ ] 리뷰 산출물에 모든 발견 사항이 표 형태로 정리
- [ ] 각 발견 사항에 결정 (수정/수용/반박) 라벨
- [ ] work.json.codeReviewDone이 true로 갱신됐는지 확인

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

## 6.5 codeReviewDone 기록

리뷰 종료 직전 (publish 여부와 무관하게):

`.workflow/<작업번호>/work.json`을 Read → `codeReviewDone` 필드를 `true`로 설정 → Write.

이 단계를 건너뛰면 `finish-work` 진입이 영구 차단된다.

## 7. 종료 안내

리뷰 종료 후:

```
코드 리뷰 완료. 다음 권장 단계: 작업 종결.
새 세션에서 /yeoboya-select-subtask을 호출하세요.
```
