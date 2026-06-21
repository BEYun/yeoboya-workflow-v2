---
name: yeoboya-write-policy-feedback
description: "Use ONLY when yeoboya-route-work triggers this skill. NEVER invoke directly. Reads referenced 기획서 PDF (path) or Notion 기획서 page, walks the user through 5-perspective review (화면 흐름·상태 정의·엣지 케이스·인터랙션·일관성), drafts the 기획서 검토 markdown using references/policy-feedback-template.md, runs self-validation, then calls yeoboya-publish-notion with key='write-policy-feedback'."
user-invocable: false
---

# yeoboya-write-policy-feedback

기획서 PDF 검토 stage. write-policy의 직전 입력을 만든다.

## 1. 전제

- work.json 존재 (route-work이 trigger)
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회 호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다 — (a) 다른 작업자가 만든 선행 문서를 links에서 인식, (b) 본 산출물이 이미 있으면 publish가 update가 되어 중복 페이지 방지.

## 2. 입력 fetch

1. 기획서 출처를 사용자에게 질문:
   ```
   기획서 출처를 알려주세요:
     - PDF 경로 (예: ~/Downloads/기획서_v6.pdf)
     - Notion 페이지 URL
   ```
2. PDF면 Read 도구로 페이지 단위 읽기. Notion이면 `notion-fetch`.

## 3. 작성 절차

1. **관점별 스캔** — 화면 흐름 / 상태 정의 / 엣지 케이스 / 인터랙션 / 일관성 5관점으로 순차 검토. 각 발견 사항을 메모.
2. **우선순위 분류** — 발견 사항을 Critical/Major/Minor로 분류.
   - Critical: 비즈니스 핵심 정책 공백 (정책서 작성을 막을 정도)
   - Major: 운영 시 문제 발생 가능
   - Minor: 사용성/완성도
3. **권고 도출** — 기획자에게 전달할 보완 항목을 "정책"/"문서" 두 카테고리로 정리.
4. **마크다운 작성** — `references/policy-feedback-template.md` 구조에 맞춤.
   - Critical은 이슈별 세부 표 (페이지/원문/문제/권고)
   - Major/Minor는 단일 표 (# / 페이지 / 관점 / 이슈 / 원문)
   - ID 패턴: `C#`/`M#`/`N#`

## 4. Self-validation (publish 직전)

- [ ] 검토 대상에 출처(PDF 파일명 또는 Notion link) + 페이지 수 명시
- [ ] 검토 관점 5종 모두 명시
- [ ] 검토 결과 요약 표에 Critical/Major/Minor 건수 (0건이라도 명시)
- [ ] Critical이 있으면 각 이슈가 페이지/원문/문제/권고 4행 표
- [ ] Major/Minor가 있으면 단일 표 형식
- [ ] 권고 섹션이 "정책"/"문서" 둘 다 등장 (해당 없음일 시 "없음" 명시)

실패 시 사용자에게 누락 항목 안내 후 보완.

## 5. publish

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "write-policy-feedback"
  markdown: <위에서 작성한 마크다운>
  properties: { workType: <workType>, 작업명: <name>, 도메인: <도메인 or 생략> }
```

publish 후 notion-page-record hook이 work.json.links['write-policy-feedback']에 pageId를 자동 기록한다.

## 6. 종료 안내

```
기획서 검토 완료. 다음 권장 단계: 정책서 작성.
컨텍스트 정리를 위해 새 세션에서 /yeoboya-route-work을 호출하세요.
```
