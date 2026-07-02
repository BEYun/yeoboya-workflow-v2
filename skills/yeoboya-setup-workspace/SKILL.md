---
name: yeoboya-setup-workspace
description: "사용자가 /yeoboya-setup-workspace를 호출할 때, workspace.json이 없어 다른 yeoboya-* 스킬이 부트스트랩해야 할 때, 또는 사용자가 'plugin setup', 'workspace setup', '플러그인 설정', '워크스페이스 설정'을 언급할 때 사용한다. 모든 /yeoboya-create-work 호출 이전에 반드시 먼저 실행해야 한다. superpowers · Notion MCP · 하네스 플러그인 3개 선행조건을 검증하고, 서비스/플랫폼/작업자/Notion 설정을 수집하며, .workflow/workspace.json을 작성한다."
---

# yeoboya-setup-workspace

플러그인 최초 설정. `.workflow/workspace.json`을 생성한다.

## 1. Prerequisite 검증 (필수, 첫 단계)

본 skill은 시작 직후 다음을 확인하고, 누락 시 안내 후 종료한다.

| 검증 항목 | 확인 방법 |
|---|---|
| superpowers 플러그인 | superpowers의 skill 중 하나(예: `brainstorming`, `writing-plans`)가 available skills에 노출되는지 |
| Notion MCP | 노출된 도구 중 이름이 `__notion-search`로 끝나는 것을 빈 쿼리(`""`)로 실제 호출한다. (도구명은 `mcp__<서버>__notion-search` 형식이며 `<서버>` 접두사는 커넥터마다 다르다 — 로컬 구성 시 읽기 쉬운 이름, claude.ai 커넥터 시 UUID. 서버명에 결합하지 말 것.) 응답이 오면(빈 결과라도) 가용. 그런 도구가 없거나 도구 호출 오류가 나면 미설치. |
| 하네스 플러그인 | 하네스 스킬(예: `harness-root`, `harness-check`)이 available skills에 노출되는지. write-code가 하네스 `work` 닫힌 루프에 위임하므로 하드 의존이다. |

누락 시 출력 예시:
```
이 플러그인은 다음 설치가 필요합니다:
  - superpowers 플러그인 (https://github.com/anthropics/claude-plugins)
  - Notion MCP (notion-search 도구 호출 실패)
  - 하네스 플러그인 (harness-root 스킬 미노출 — 하네스 work 닫힌 루프 의존)

설치 후 다시 /yeoboya-setup-workspace를 호출하세요.
```

## 1.5 하네스 부트스트랩 확인 (1회)

prerequisite 통과 후, 현재 repo에 하네스 문서가 있는지 **1회** 확인한다. work 닫힌 루프는 `docs/rules/TESTING.md`(완료기준 명령 단일 출처)와 `CONVENTIONS`/`ARCHITECTURE`(검토 기준)에 의존한다.

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
if [ -f "$ROOT/CLAUDE.md" ] && [ -f "$ROOT/docs/CONVENTIONS.md" ] \
   && [ -f "$ROOT/docs/rules/TESTING.md" ] && grep -q . "$ROOT/docs/rules/TESTING.md"; then
  echo "BOOTSTRAPPED"
else
  echo "NOT_BOOTSTRAPPED"
fi
```

- `BOOTSTRAPPED` → workspace.json의 `harness.bootstrapped = true`로 기록(§3).
- `NOT_BOOTSTRAPPED` → `harness.bootstrapped = false`로 기록하고 아래 안내 출력. workspace.json 작성은 계속 진행한다(셋업 자체는 막지 않음).

```
이 repo는 아직 하네스 부트스트랩이 안 됐습니다.
work 닫힌 루프는 docs/rules/TESTING.md(완료기준 명령 출처)와
CONVENTIONS/ARCHITECTURE(검토 기준)에 의존합니다.
먼저 1회: /harness-root 를 실행하면 위 루트 문서가 생깁니다.
(leaf 모듈별 CLAUDE.md가 필요하면 이어서 /harness-module —
 부트스트랩 판정에는 필수가 아닙니다.)
그 뒤 다시 /yeoboya-setup-workspace를 호출하면 부트스트랩이 확정됩니다.
(부트스트랩 전에는 write-code가 work 호출을 차단합니다.)
```

## 2. 입력 수집 (한 번에 하나씩)

prerequisite 통과 후 사용자에게 묻는 것은 아래 4개이고, Notion 식별자(작업 DB URL·작업자 페이지 ID)는 §2.5에서 Notion에서 fetch해 자동 확정한다.

**반드시 한 번에 한 질문씩 묻고, 답을 받은 뒤 다음 질문으로 넘어간다. 네 항목을 한 메시지에 묶어서 묻지 않는다.** 순서:

1. **서비스 선택** — 먼저 이것만 묻는다. 보기: 1. 달라 2. 클럽라이브 3. 여보야 4. 클럽5678 5. AI식단. 답을 받기 전에는 다음 질문을 하지 않는다.
2. **플랫폼** — 서비스 답을 받은 뒤에만 묻는다. 보기: iOS / Android.
3. **작업자 이름** — 플랫폼 답을 받은 뒤에만 묻는다 (예: "홍길동").
4. **디자인 툴** — 작업자 이름 답을 받은 뒤에만 묻는다. 보기: 1. Figma  2. Zeplin  3. 없음. 서비스마다 사용 툴이 달라 명시적으로 묻는다(추론 금지). 선택 후 아래 연결 안내를 1회 출력한다.
   - **Figma/Zeplin 선택** → 안내: "write-code가 디자인을 읽으려면 해당 MCP 커넥터가 연결돼 있어야 합니다. 미연결이면 커넥터를 추가한 뒤 다시 /yeoboya-setup-workspace를 호출하세요(미연결이어도 설정은 저장됩니다)." 노출 도구에 그 툴의 대표 read 도구(`hooks/lib/constants.json`의 `DESIGN_TOOLS[<tool>].detectToolSuffixes` 중 하나라도, suffix 매칭 — 서버 접두사에 결합 금지)가 있으면 `design.connected=true`, 없으면 `false`로 §3에 기록한다(best-effort, 차단 없음).
   - **없음 선택** → 안내 없이 `design.tool=null`로 기록. write-code에서 디자인 링크 물음을 생략한다.

네 답이 모두 모인 뒤에 "Notion에서 작업 DB와 작업자를 확인합니다"라고 안내하고 §2.5로 진행한다.

> 작업 DB URL·작업자 페이지 ID를 사용자에게 직접 입력받지 않는다. 도메인 매핑은 수집하지 않는다(작업 단위 관심사 — Notion 작업 row의 `도메인` select가 권위 출처이며 workspace는 알 필요 없음).

## 2.5 Notion 식별자 fetch (자동 확정)

§2의 서비스·작업자로 두 식별자를 Notion에서 해소해 §3 `workspace.json.notion`에 캐시한다. Notion 측 모델은 `references/notion-schema.md`가 SoT. 도구는 항상 suffix(`__notion-search` 등)로 매칭(§1 규약). **모호하면 임의 선택 금지 — 후보를 보여주고 사용자가 고르게 한다.** 내부 섹션 번호("2.5단계")나 도구 로딩을 사용자에게 말하지 말고 "Notion에서 작업 DB와 작업자를 확인합니다" 정도로만 안내한다.

**`workDbDataSourceUrl` — 선택 서비스의 작업 DB.** 서비스마다 다르고 `서비스 목록 → <서비스> → 작업 목록 → 작업 DB` 계층에 있다. 동명 "작업 DB"가 5개라 직접 검색은 금물 — 계층을 탄다:

1. `__notion-search`로 **서비스명**을 찾아 ancestor가 `서비스 목록`인 페이지를 확정한다.
2. 그 페이지를 `__notion-fetch`로 열어 `작업 목록` 자식 페이지를 찾는다.
3. `작업 목록`을 `__notion-fetch`로 열면 인라인 `<database … data-source-url="collection://…">`가 있다. 그 `data-source-url`이 확정값이다.

**`workerPageId` — 팀원 목록 DB의 작업자 행.** 워크스페이스 계정(`get-users`)이 **아니다** — 전 서비스 공용 `팀원 목록` DB의 한 행이다. 팀원 목록 DB URL은 `notion-schema.md §1` 고정값(`collection://cc47fa31-…`)이며, 없으면 `__notion-search query="팀원 목록"`의 `type=database` 결과를 fetch해 얻는다.

1. `__notion-query-data-sources`로 조회한다: `SELECT url, "이름" FROM "<팀원 목록 DB url>" WHERE "이름" = '<작업자>'`.
2. 1행이면 그 `url`의 페이지 ID가 확정값이다.
3. 다수면 `개발 서비스`(§2 서비스 포함)·`플랫폼`으로 좁힌다.

## 3. `.workflow/workspace.json` 작성

`references/state-schema.md §3` 스키마 준수. 예시:

```json
{
  "services": ["달라", "클럽라이브", "여보야", "클럽5678", "AI식단"],
  "platform": "iOS",
  "worker": "홍길동",
  "activeWork": null,
  "harness": { "bootstrapped": false, "checkedAt": "2026-06-28" },
  "design": { "tool": "figma", "connected": true, "checkedAt": "2026-06-28" },
  "notion": {
    "workDbDataSourceUrl": "https://...",
    "workerPageId": "abc..."
  }
}
```

`notion.workDbDataSourceUrl`/`workerPageId`는 §2.5에서 fetch한 확정값을 캐시한다(사용자 입력값이 아님). `domainMapping`은 더 이상 두지 않는다.
`harness.bootstrapped`/`checkedAt`은 §1.5 확인 결과로 채운다. `checkedAt`은 `TZ=Asia/Seoul date +%Y-%m-%d`.
`design`은 §2 4번 답으로 채운다: `tool` ∈ {`figma`, `zeplin`, `null`}, `connected`는 best-effort 연결 감지 결과(state-schema §3). Notion·하네스와 달리 **하드 선행조건이 아니다** — 미연결/없음이어도 setup을 막지 않는다.

이미 `.workflow/workspace.json`이 존재하면 갱신 모드 — 기존 값을 default로 보여주고 변경 항목만 수정.

## 4. 종료 안내

```
워크스페이스 설정 완료. 다음 단계:
  새 작업: /yeoboya-create-work <작업번호>
  진행 중 작업 재개: /yeoboya-select-subtask
```

## 5. Self-validation

publish 단계가 없는 skill이지만, workspace.json 작성 직전에 다음을 확인:
- 모든 필수 필드 채워졌는지 (services, platform, worker, notion.workDbDataSourceUrl, notion.workerPageId, harness.bootstrapped)
- `notion.workDbDataSourceUrl`/`workerPageId`가 §2.5 fetch로 확정된 값인지 (빈 문자열/플레이스홀더 아님)
- `notion`에 `domainMapping` 키가 없는지
- `design.tool`이 `figma`|`zeplin`|`null` 중 하나로 기록됐는지(감지 결과 `connected` 포함)
- JSON 파싱 가능한지 (`JSON.stringify` round-trip)
