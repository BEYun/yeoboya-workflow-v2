#!/usr/bin/env node
'use strict';

const { log } = require('./lib/hook-runtime');
const { readActiveTask, readProgress } = require('./lib/progress');

// Mirrors STAGE_ORDER + STAGE_LABELS from references/state-schema.md §4.
// Kept inline here because Node hooks can't import from markdown.
const STAGE_ORDER = [
  'write-policy', 'write-domain', 'draw-ui-flow', 'draw-data-flow',
  'write-code', 'fix-bug',
  'review-code', 'write-qa', 'fix-qa-bug', 'finish-work',
];
const STAGE_LABELS = {
  'write-policy': '정책서 작성',
  'write-domain': '도메인 명세서',
  'draw-ui-flow': 'UI 흐름도',
  'draw-data-flow': '데이터 흐름도',
  'write-code': '코드 작성',
  'fix-bug': '버그 수정',
  'review-code': '코드 리뷰',
  'write-qa': 'QA 시나리오',
  'fix-qa-bug': 'QA 버그 수정',
  'finish-work': '작업 종결',
};
const FINAL_STATUSES = new Set(['done', 'published', 'skipped']);

function pickNextStage(stages) {
  for (const key of STAGE_ORDER) {
    const entry = stages?.[key];
    if (!entry) continue;
    if (!FINAL_STATUSES.has(entry.status)) return key;
  }
  return null;
}

function emit(additionalContext) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext }
  }) + '\n');
  process.exit(0);
}

function silent() {
  process.exit(0);
}

function buildResumeBlock({ task, progress }) {
  const lines = ['<yeoboya-workflow-resume>'];
  lines.push(`진행 중 작업이 감지되었습니다: **${task}**`);

  if (!progress) {
    lines.push('상태: workspace.json에 activeTask는 있으나 progress.json 미생성.');
    lines.push('새 작업 부트스트랩이 필요합니다 — `/yeoboya-start-work <작업번호>`를 호출하세요.');
  } else {
    const workType = progress.workType ?? '미지정';
    const nextKey = pickNextStage(progress.stages);
    const nextLabel = nextKey ? STAGE_LABELS[nextKey] : '없음 (모두 완료)';
    lines.push(`workType: ${workType}`);
    lines.push(`다음 권장 단계: ${nextLabel}`);
    lines.push('');
    lines.push('재개는 `/yeoboya-continue-work`을 호출하세요.');
  }

  lines.push('</yeoboya-workflow-resume>');
  return lines.join('\n');
}

(async () => {
  const root = process.env.DEV_ROOT || process.cwd();

  let task;
  try {
    task = readActiveTask(root);
  } catch (e) {
    log({ hook: 'session-resume', event: 'read-error', message: String(e?.message || e) });
    return silent();
  }

  if (!task) {
    log({ hook: 'session-resume', event: 'skip', reason: 'no-active-task' });
    return silent();
  }

  let progress = null;
  try {
    progress = readProgress(root, task);
  } catch (e) {
    log({ hook: 'session-resume', event: 'progress-read-error', task, message: String(e?.message || e) });
  }

  const ctx = buildResumeBlock({ task, progress });
  log({ hook: 'session-resume', event: 'inject', task, hasProgress: !!progress });
  emit(ctx);
})();
