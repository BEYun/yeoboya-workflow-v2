---
name: yeoboya-write-policy
description: "Use ONLY when yeoboya-route-work triggers this work-list item. NEVER invoke directly. Reads referenced 기획서 from Notion, walks the user through review items, drafts the 정책서 markdown using references/policy-template.md, runs self-validation, then calls yeoboya-publish-notion with title='정책서'. The notion-page-record hook records the pageId into work.json.links automatically."
user-invocable: false
---

# yeoboya-write-policy

정책서 작성 (v1 work-define + spec-review + spec-finalize 통합).

## 1. 전제

- work.json 존재.
- 기획서 검토 산출물(work.json.links['write-policy-feedback'])이 있으면 입력으로 활용한다. 없으면 사용자에게 알리고 계속 진행할지 확인한다 (강제 종료 없음).
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회 호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다 — (a) 다른 작업자가 만든 선행 문서를 links에서 인식, (b) 본 산출물이 이미 있으면 publish가 update가 되어 중복 페이지 방지.

## 2. 입력 fetch

1. Notion에서 작업 DB row 조회 (yeoboya-publish-notion mode=sync) → 작업명/도메인/담당자 등 보조 정보
2. **기획서 검토 페이지 fetch** (`work.json.links['write-policy-feedback']` → notion-fetch)
3. workType=update + referenceWork 있을 시: 참고 작업의 정책서(`<referenceWork>`의 work.json.links['write-policy']) fetch

## 3. 작성 절차

1. **검토 결과 흡수** — 기획서 검토 페이지의 Critical/Major/Minor + 권고 항목을 사용자와 함께 정책 결정으로 변환:
   - Critical 권고 → POL 카탈로그의 새 정책 또는 예외/롤백 카테고리
   - Major 이슈 → 파라미터 표 또는 POL 카탈로그
   - 권고(문서) → 본문 보완 항목으로 흡수
2. **본문 작성** — `references/policy-template.md` 구조 그대로 9 섹션 (용어/역할/파라미터/정책 카탈로그/예외·롤백/변경 이력/배경/측정 지표/원본 자료).
   - POL-NNN ID는 등록 순번. 카테고리는 도메인별 자유 정의.
   - 예외·롤백 동작 유형은 template 6종 (Auto-Fallback / Toast Notice / Invalidation / Deferral / Early Settlement / Non-Participation) 외 신규 카테고리 추가 가능.
3. **변경 이력** — workType=update 또는 재publish 시 §변경 이력에 1행 이상 추가.

## 4. Self-validation (publish 직전)

- [ ] 페이지 제목 = "정책서" (hook 매핑용)
- [ ] 메타 (업로드 일시 + 작업자) 명시
- [ ] §용어 표 1행 이상
- [ ] §역할 표 1행 이상
- [ ] §파라미터 표 1행 이상 (해당 없으면 "해당 없음" 명시)
- [ ] §정책 카탈로그에 카테고리 1개 이상 + POL-001 이상 ID 1개 이상
- [ ] §정책 카탈로그의 모든 POL 행이 `예외` 컬럼 명시 (예외 없으면 "—")
- [ ] §예외/롤백 동작 유형 분류 1개 이상 (해당 없으면 "해당 없음" 명시) — 각 분류는 트리거/동작/메시지 3열 표
- [ ] §변경 이력 1행 이상
- [ ] §원본 자료 1개 이상

실패 시 사용자에게 누락 항목 안내 후 보완.

## 5. publish

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "write-policy"
  markdown: <위에서 작성한 마크다운>
  properties: { workType: <workType>, 작업명: <name>, 도메인: <도메인 or 생략> }
```

publish 후 notion-page-record hook이 work.json.links['write-policy']에 pageId를 자동 기록.

## 6. 종료 안내

```
정책서 작성 완료. 다음 권장 단계: 도메인 명세서.
컨텍스트 정리를 위해 새 세션에서 /yeoboya-route-work을 호출하세요.
```
