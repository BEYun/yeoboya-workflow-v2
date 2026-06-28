---
name: yeoboya-write-domain
description: "yeoboya-select-subtask이 이 세부 작업을 trigger할 때만 사용한다. 직접 호출 금지. Notion에서 정책서를 가져와, 도메인 객체/규칙/액터/이벤트 모델링을 사용자와 함께 진행하고, 자체 검증을 실행한 뒤, title='도메인 명세서'로 yeoboya-publish-notion을 호출한다."
user-invocable: false
---

# yeoboya-write-domain

도메인 명세서 작성.

## 1. 전제

- work.json 존재.
- 정책서(work.json.links['write-policy'])가 있으면 SOT로 사용한다. 없으면 사용자에게 알리고 진행 여부를 확인한다.
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회 호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다 — (a) 다른 작업자가 만든 선행 문서를 links에서 인식, (b) 본 산출물이 이미 있으면 publish가 update가 되어 중복 페이지 방지.

## 2. 입력 fetch

1. 정책서 fetch (work.json.links['write-policy'] → notion-fetch)

## 3. 작성 절차

1. **정책 SOT footnote 확정** — `work.json.links['write-policy']`를 정책 SOT link로 사용.
2. **엔터티 도출** — 정책서 §용어/§역할/§정책 카탈로그에서 도메인 객체를 식별. 각 객체의 필드를 표로 정리. DB 식별자(`id`, 외래키)는 데이터 흐름도에서 확정하므로 본 문서엔 포함하지 않음.
3. **역할별 시나리오** — 정책서 §역할 그대로 사용 + 각 역할의 주요 시나리오 행.
4. **상태 머신** — 상태가 있는 엔터티만 §3.X 서브섹션 작성:
   - Mermaid stateDiagram-v2
   - 전이 규칙 표 (From → To / 조건 / 역할)
   - 불변식 글머리
5. **결정 필요 항목** — 정책서/검토에서 미해결로 남은 도메인 의문점. 없으면 "현재 없음" 명시.

본문 구조는 `references/domain-template.md`를 직접 따른다.

## 4. Self-validation (publish 직전)

- [ ] 페이지 제목 = "도메인 명세서"
- [ ] 첫 줄 또는 footnote에 정책 SOT link (정책서 페이지 URL)가 존재
- [ ] §1 엔터티 1개 이상, 각 엔터티는 필드 표 존재
- [ ] §2 역할별 시나리오 표 1행 이상, 역할 명칭이 정책서 §역할과 일치
- [ ] 상태 머신이 필요한 엔터티는 §3.X에 Mermaid stateDiagram + 전이 규칙 + 불변식 모두 존재
- [ ] §4 결정 필요 항목이 명시되거나 "현재 없음"

## 5. publish

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "write-domain"
  markdown: <본문>
```

properties는 비워둠 (작업명/도메인/담당자 변경 없음).

## 6. 종료 안내

```
도메인 명세서 작성 완료. 다음 권장 단계: UI 흐름도.
새 세션에서 /yeoboya-select-subtask을 호출하세요.
```
