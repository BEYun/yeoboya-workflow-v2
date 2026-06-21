---
name: yeoboya-setup-workspace
description: "Use when the user invokes /yeoboya-setup-workspace, when workspace.json is missing and any other yeoboya-* skill needs to bootstrap, or when the user mentions 'plugin setup', 'workspace setup', '플러그인 설정', '워크스페이스 설정'. MANDATORY first run before any /yeoboya-create-work invocation. Verifies superpowers + Notion MCP prerequisites, collects service/platform/worker/Notion settings, writes .workflow/workspace.json."
---

# yeoboya-setup-workspace

플러그인 최초 설정. `.workflow/workspace.json`을 생성한다.

## 1. Prerequisite 검증 (필수, 첫 단계)

본 skill은 시작 직후 다음을 확인하고, 누락 시 안내 후 종료한다.

| 검증 항목 | 확인 방법 |
|---|---|
| superpowers 플러그인 | superpowers의 skill 중 하나(예: `brainstorming`, `writing-plans`)가 available skills에 노출되는지 |
| Notion MCP | `mcp__claude_ai_Notion__notion-search`를 빈 쿼리(`""`)로 실제 호출한다. 응답이 오면(빈 결과라도) 가용. 도구를 찾을 수 없다는 오류가 나면 미설치. |

누락 시 출력 예시:
```
plugin v2는 다음 설치가 필요합니다:
  - superpowers 플러그인 (https://github.com/anthropics/claude-plugins)
  - Notion MCP (notion-search 도구 호출 실패)

설치 후 다시 /yeoboya-setup-workspace를 호출하세요.
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
  "notion": {
    "workDbDataSourceUrl": "https://...",
    "workerPageId": "abc...",
    "domainMapping": {}
  }
}
```

이미 `.workflow/workspace.json`이 존재하면 갱신 모드 — 기존 값을 default로 보여주고 변경 항목만 수정.

## 4. 종료 안내

```
워크스페이스 설정 완료. 다음 단계:
  새 작업: /yeoboya-create-work <작업번호>
  진행 중 작업 재개: /yeoboya-route-work
```

## 5. Self-validation

publish 단계가 없는 skill이지만, workspace.json 작성 직전에 다음을 확인:
- 모든 필수 필드 채워졌는지 (services, platform, worker, notion.workDbDataSourceUrl, notion.workerPageId)
- JSON 파싱 가능한지 (`JSON.stringify` round-trip)
