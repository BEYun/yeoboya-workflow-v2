---
name: yeoboya-setup-workspace
description: "사용자가 /yeoboya-setup-workspace를 호출할 때, workspace.json이 없어 다른 yeoboya-* 스킬이 부트스트랩해야 할 때, 또는 사용자가 'plugin setup', 'workspace setup', '플러그인 설정', '워크스페이스 설정'을 언급할 때 사용한다. 모든 /yeoboya-create-work 호출 이전에 반드시 먼저 실행해야 한다. superpowers + Notion MCP 선행조건을 검증하고, 서비스/플랫폼/작업자/Notion 설정을 수집하며, .workflow/workspace.json을 작성한다."
---

# yeoboya-setup-workspace

플러그인 최초 설정. `.workflow/workspace.json`을 생성한다.

## 1. Prerequisite 검증 (필수, 첫 단계)

본 skill은 시작 직후 다음을 확인하고, 누락 시 안내 후 종료한다.

| 검증 항목 | 확인 방법 |
|---|---|
| superpowers 플러그인 | superpowers의 skill 중 하나(예: `brainstorming`, `writing-plans`)가 available skills에 노출되는지 |
| Notion MCP | `mcp__claude_ai_Notion__notion-search`를 빈 쿼리(`""`)로 실제 호출한다. 응답이 오면(빈 결과라도) 가용. 도구를 찾을 수 없다는 오류가 나면 미설치. |
| 하네스 플러그인 | 하네스 스킬(예: `harness-root`, `harness-check`)이 available skills에 노출되는지. write-code가 `work` 닫힌 루프에 위임하므로 하드 의존이다. |

누락 시 출력 예시:
```
plugin v2는 다음 설치가 필요합니다:
  - superpowers 플러그인 (https://github.com/anthropics/claude-plugins)
  - Notion MCP (notion-search 도구 호출 실패)
  - 하네스 플러그인 (harness-root 스킬 미노출 — work 닫힌 루프 의존)

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
먼저 1회: /harness-root → /harness-module 을 실행한 뒤,
다시 /yeoboya-setup-workspace를 호출하면 부트스트랩이 확정됩니다.
(부트스트랩 전에는 write-code가 work 호출을 차단합니다.)
```

## 2. 입력 수집 (순서)

prerequisite 통과 후 사용자에게 순차 질문:

1. **서비스 선택** (1~5): 달라 / 클럽라이브 / 여보야 / 클럽5678 / AI식단
2. **플랫폼** (iOS / Android)
3. **작업자 이름** (예: "윤병은")
4. **Notion 작업 DB DataSource URL** — Notion 작업 DB의 data source URL
5. **작업자 Notion 페이지 ID** — workerPageId (Notion 사용자/페이지 ID)
6. **도메인 매핑** — services 5개 외에 Notion DB의 '도메인' select 값이 다르면 매핑 표 작성 (옵션)

## 3. `.workflow/workspace.json` 작성

`references/state-schema.md §3` 스키마 준수. 예시:

```json
{
  "services": ["달라", "클럽라이브", "여보야", "클럽5678", "AI식단"],
  "platform": "iOS",
  "worker": "윤병은",
  "activeWork": null,
  "harness": { "bootstrapped": false, "checkedAt": "2026-06-28" },
  "notion": {
    "workDbDataSourceUrl": "https://...",
    "workerPageId": "abc...",
    "domainMapping": {}
  }
}
```

`harness.bootstrapped`/`checkedAt`은 §1.5 확인 결과로 채운다. `checkedAt`은 `TZ=Asia/Seoul date +%Y-%m-%d`.

이미 `.workflow/workspace.json`이 존재하면 갱신 모드 — 기존 값을 default로 보여주고 변경 항목만 수정.

## 4. 종료 안내

```
워크스페이스 설정 완료. 다음 단계:
  새 작업: /yeoboya-create-work <작업번호>
  진행 중 작업 재개: /yeoboya-route-work
```

## 5. Self-validation

publish 단계가 없는 skill이지만, workspace.json 작성 직전에 다음을 확인:
- 모든 필수 필드 채워졌는지 (services, platform, worker, notion.workDbDataSourceUrl, notion.workerPageId, harness.bootstrapped)
- JSON 파싱 가능한지 (`JSON.stringify` round-trip)
