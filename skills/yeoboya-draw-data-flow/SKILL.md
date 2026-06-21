---
name: yeoboya-draw-data-flow
description: "Use ONLY when yeoboya-route-work triggers this work-list item. NEVER invoke directly. For each user action ID from the UI 흐름도, defines the corresponding data flow action (API endpoint, Socket event, or local operation). Endpoints follow /도메인명 convention. Self-validates that every UI action ID is mapped. Publishes 'Notion 데이터 흐름도'."
user-invocable: false
---

# yeoboya-draw-data-flow

데이터 흐름도. **UI 흐름도의 액션 ID마다 데이터 흐름 액션**을 정의하고, 각 데이터 흐름 액션을 API endpoint, Socket event, 또는 로컬 연산으로 명시.

## 1. 전제

- work.json 존재.
- UI 흐름도(work.json.links['draw-ui-flow'])와 도메인 명세서(work.json.links['write-domain'])가 있으면 참고한다. 없으면 사용자에게 알리고 진행 여부를 확인한다.

## 2. 입력 fetch

- UI 흐름도 + 도메인 명세서 fetch
- UI 흐름도의 §2 사용자 액션 표에서 모든 액션 ID 추출

## 3. 작성 절차

본 stage는 **두 페이지**를 publish한다:
1. "데이터 흐름도" (parent)
2. "통신 명세서" (parent의 서브페이지로 link)

### 3.1 데이터 흐름도 작성

`references/data-flow-template.md`를 직접 따른다.

1. 정책서 §역할 + UI 흐름도 §2 액션 정의를 fetch
2. 역할 인벤토리 — 정책서 §역할 그대로
3. 엔터티 책임 매트릭스 — 도메인 명세서 §1의 모든 엔터티에 대해 상태 주체 선언
4. (optional) 상태 모델 동기화 메모 — 도메인과 같으면 "동일", 다르면 대응표
5. 각 역할별로:
   - 시퀀스 다이어그램 (actor/FE/BE/DB participants, rect로 단계 그룹)
   - 액션·채널 매트릭스 (Action ID는 UI 흐름도 §2에서 재사용, Event ID는 본 페이지에서 신규 정의)

### 3.2 통신 명세서 작성

`references/comm-spec-template.md`를 직접 따른다.

1. 채널 정의 — 페이로드 봉투 형식, 인증 정책
2. API endpoint 카탈로그 — `/<도메인명>/<리소스>` 규약 + [확정]/[논의중] 상태
3. Socket cmd 카탈로그 — 발신자/payload + [확정]/[논의중] 상태

API endpoint는 데이터 흐름도 액션·채널 매트릭스의 API 행과 1:1, Socket cmd는 Socket 행과 1:1.

## 4. Self-validation (publish 직전)

### 데이터 흐름도 페이지

- [ ] 페이지 제목 = "데이터 흐름도"
- [ ] 정책/도메인/UI 흐름도 + 통신 명세서 link 4종 footnote 존재
- [ ] 역할 인벤토리가 정책서 §역할의 subset (또는 일치)
- [ ] 엔터티 책임 매트릭스에 도메인 명세서 §1의 모든 엔터티가 등장
- [ ] 상태 모델 동기화 메모 — "동일" 또는 대응표
- [ ] 각 역할이 시퀀스 다이어그램 + 액션·채널 매트릭스 모두 존재
- [ ] 시퀀스 다이어그램에 actor/FE/BE/DB participants 모두 등장
- [ ] 액션·채널 매트릭스의 `Action ID`가 UI 흐름도 §2에 존재
- [ ] 액션·채널 매트릭스의 `Event ID`는 패턴 `<역할>:Event:N` + 역할별 unique

### 통신 명세서 페이지

- [ ] 페이지 제목 = "통신 명세서"
- [ ] 데이터 흐름도 link footnote 존재
- [ ] 채널 정의 표 1행 이상
- [ ] 각 API endpoint가 `/<도메인명>/<리소스>` 컨벤션 준수
- [ ] 각 endpoint/cmd에 상태 ([확정] 또는 [논의중]) 명시
- [ ] 데이터 흐름도 액션·채널 매트릭스의 모든 `메서드/이벤트명`이 본 페이지에 등장 (1:1 매핑)
- [ ] 본 페이지에 등장하는 모든 endpoint/cmd가 데이터 흐름도에서 사용됨 (역방향 검증)

## 5. publish

두 페이지를 **순차** publish (parent 먼저, child 뒤):

### 5.1 데이터 흐름도

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "draw-data-flow"
  title: "데이터 흐름도"
  markdown: <데이터 흐름도 본문>
```

hook이 자동으로 work.json.links['draw-data-flow']['데이터 흐름도'] = <pageId>를 기록한다.

### 5.2 통신 명세서

```
yeoboya-publish-notion 호출:
  work: <작업번호>
  mode: "dispatch"
  key: "draw-data-flow"
  title: "통신 명세서"
  markdown: <통신 명세서 본문>
  # 본 페이지를 데이터 흐름도 페이지의 자식으로 두려면 publish-notion이 parent 인자를 지원해야 함.
  # 미지원이면 같은 dataSource에 평시 페이지로 publish 후, 데이터 흐름도 §footnote의 link만 수동 갱신.
```

두 번째 publish 후 hook이 work.json.links['draw-data-flow']['통신 명세서'] = <pageId>를 추가 기록한다. (파이프라인 상태 변경 없음.)

### 5.3 데이터 흐름도 footnote 갱신

통신 명세서 publish 결과 pageId/URL을 데이터 흐름도 본문 §footnote의 "통신 명세서 서브페이지" link로 갱신 (publish-notion mode="dispatch" 한 번 더, title="데이터 흐름도", markdown 전체 재작성 또는 update_content로 해당 라인만 교체).

## 6. 종료 안내

```
데이터 흐름도 작성 완료. 다음 권장 단계: 코드 작성.
새 세션에서 /yeoboya-route-work을 호출하세요.
```
