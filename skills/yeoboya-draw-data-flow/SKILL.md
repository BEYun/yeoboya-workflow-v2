---
name: yeoboya-draw-data-flow
description: "yeoboya-select-subtask이 이 세부 작업을 trigger할 때만 사용한다. 직접 호출 금지. UI 흐름도의 각 사용자 액션 ID마다 대응하는 데이터 흐름 액션(API 엔드포인트, Socket 이벤트, 또는 로컬 연산)을 정의한다. 엔드포인트는 /도메인명 규칙을 따른다. 모든 UI 액션 ID가 매핑되었는지 자체 검증한다. 'Notion 데이터 흐름도'를 게시한다."
user-invocable: false
---

# yeoboya-draw-data-flow

데이터 흐름도. **UI 흐름도의 액션 ID마다 데이터 흐름 액션**을 정의하고, 각 데이터 흐름 액션을 API endpoint, Socket event, 또는 로컬 연산으로 명시.

## 1. 전제

- work.json 존재.
- UI 흐름도(work.json.links['draw-ui-flow'])와 도메인 명세서(work.json.links['write-domain'])가 있으면 참고한다. 없으면 사용자에게 알리고 진행 여부를 확인한다.
- **진입 시 sync (필수 첫 동작)**: `yeoboya-publish-notion mode="sync-links"`(work=작업번호)를 1회 호출해 작업 row 자식 페이지를 `work.json.links`에 동기화한다 — (a) 다른 작업자가 만든 선행 문서를 links에서 인식, (b) 본 산출물이 이미 있으면 publish가 update가 되어 중복 페이지 방지.

## 2. 입력 fetch

- UI 흐름도 + 도메인 명세서 fetch
- UI 흐름도 §1 화면·액션 통합 표의 "사용자 액션" 열에서 모든 액션 ID 추출
- **workType=update 이전 버전 해석** — `references/state-schema.md §6` 규칙대로 이전 데이터 흐름도/통신 명세서를 해석한다(자기 재publish, 또는 `referenceWork`의 동종 문서를 Notion 권위 출처로 해석 — 다중 페이지 키이므로 두 제목 모두 매칭). **후보 있음(분기 A)** → 두 페이지 fetch. **후보 없음(분기 B)** → §6대로 기준 모듈/파일 경로를 사용자에게 요청해 코드베이스 기반 산출. provenance는 §6 표대로 헤더 + 변경 이력에 기록.

## 3. 작성 절차

본 stage는 **두 페이지**를 publish한다:
1. "데이터 흐름도" (parent)
2. "통신 명세서" (parent의 서브페이지로 link)

### 3.1 데이터 흐름도 작성

`references/data-flow-template.md`를 직접 따른다.

1. 정책서 §페르소나 + UI 흐름도 §1 화면·액션 통합 표를 fetch
2. 페르소나 인벤토리 — 정책서 §페르소나 그대로
3. 엔터티 책임 매트릭스 — 도메인 명세서 §1의 모든 엔터티에 대해 상태 주체 선언
4. (optional) 상태 모델 동기화 메모 — 도메인과 같으면 "동일", 다르면 대응표
5. 각 페르소나별로:
   - 시퀀스 다이어그램 (actor/FE/BE/DB participants, rect로 단계 그룹)
   - 액션·채널 매트릭스 (Action ID는 UI 흐름도 §1 화면·액션 통합 표에서 재사용, Event ID는 본 페이지에서 신규 정의)
6. **변경 이력** (workType=update, `references/state-schema.md §6`) — 데이터 흐름도(parent) 페이지의 §변경 이력에 기록한다. 이전 버전이 있으면 이번 수정 1행 추가, 이전 버전 없이 신규로 진행한 경우 첫 행을 `최초 작성`으로 기록.

### 3.2 통신 명세서 작성

`references/comm-spec-template.md`를 직접 따른다.

1. 채널 정의 — 페이로드 봉투 형식, 인증 정책
2. API endpoint 카탈로그 — 메타데이터 표(액션 ID/Method/Endpoint/상태/비고, `/<도메인명>/<리소스>` 규약) + 표 아래 endpoint별 Request/Response 코드 블럭
3. Socket cmd 카탈로그 — 메타데이터 표(ID/cmd명/발신자/상태/비고) + 표 아래 cmd별 Payload 코드 블럭

API endpoint는 데이터 흐름도 액션·채널 매트릭스의 API 행과 1:1, Socket cmd는 Socket 행과 1:1.
Request/Response/Payload는 예외 없이 코드 블럭(```json)으로 감싼다 — 표 셀이나 인라인 텍스트에 직접 기술하지 않는다.

## 4. Self-validation (publish 직전)

### 데이터 흐름도 페이지

- [ ] 페이지 제목 = "데이터 흐름도"
- [ ] 정책/도메인/UI 흐름도 + 통신 명세서 link 4종 footnote 존재
- [ ] 페르소나 인벤토리가 정책서 §페르소나의 subset (또는 일치)
- [ ] 엔터티 책임 매트릭스에 도메인 명세서 §1의 모든 엔터티가 등장
- [ ] 상태 모델 동기화 메모 — "동일" 또는 대응표
- [ ] 각 페르소나가 시퀀스 다이어그램 + 액션·채널 매트릭스 모두 존재
- [ ] 시퀀스 다이어그램에 actor/FE/BE/DB participants 모두 등장
- [ ] 액션·채널 매트릭스의 `Action ID`가 UI 흐름도 §1 화면·액션 통합 표에 존재
- [ ] 액션·채널 매트릭스의 `Event ID`는 패턴 `<페르소나>:Event:N` + 페르소나별 unique
- [ ] (workType=update) 데이터 흐름도 페이지에 §변경 이력 1행 이상 (분기 B 코드베이스 산출 시 첫 행 `최초 작성`)
- [ ] (workType=update) provenance — 데이터 흐름도 헤더 "이전 버전" + 변경 이력 `참고본`이 §6 표와 일치 (referenceWork 번호 / `코드베이스: <경로>` / `—`)

### 통신 명세서 페이지

- [ ] 페이지 제목 = "통신 명세서"
- [ ] 데이터 흐름도 link footnote 존재
- [ ] 채널 정의 표 1행 이상
- [ ] API endpoint 카탈로그가 메타데이터 표 형태 (표 행마다 Method/Endpoint가 `/<도메인명>/<리소스>` 컨벤션 준수)
- [ ] Socket cmd 카탈로그가 메타데이터 표 형태
- [ ] 각 endpoint/cmd 표 행에 상태 ([확정] 또는 [논의중]) 명시
- [ ] 표에 등장하는 모든 endpoint/cmd마다 표 아래 Request/Response(또는 Payload) 코드 블럭 존재 — 코드가 표 셀이나 인라인 텍스트로 대체되지 않음
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
데이터 흐름도 작성 완료. 다음 권장 단계: QA 시나리오.
새 세션에서 /yeoboya-select-subtask을 호출하세요.
```
