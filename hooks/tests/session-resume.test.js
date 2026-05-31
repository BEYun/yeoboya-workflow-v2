const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-session-resume-'));
}

function runHook(root) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'session-resume.js')], {
    env: { ...process.env, DEV_ROOT: root, DEV_LOG_DIR: path.join(root, 'logs') },
    encoding: 'utf8',
    input: '',
  });
}

test('emits empty stdout (silent) when no activeTask', () => {
  const root = tmpRoot();
  const result = runHook(root);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('emits resume block with task + workType + next stage when progress.json exists', () => {
  const root = tmpRoot();
  const ws = path.join(root, '.workflow', 'workspace.json');
  fs.mkdirSync(path.dirname(ws), { recursive: true });
  fs.writeFileSync(ws, JSON.stringify({ activeTask: 'DCL-1234' }));
  const pg = path.join(root, '.workflow', 'DCL-1234', 'progress.json');
  fs.mkdirSync(path.dirname(pg), { recursive: true });
  fs.writeFileSync(pg, JSON.stringify({
    task: 'DCL-1234',
    workType: 'feature',
    stages: {
      'write-policy': { status: 'published' },
      'write-domain': { status: 'todo' }
    }
  }));
  const result = runHook(root);
  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.match(ctx, /<yeoboya-workflow-resume>/);
  assert.match(ctx, /DCL-1234/);
  assert.match(ctx, /feature/);
  assert.match(ctx, /도메인 명세서/);
  assert.match(ctx, /\/yeoboya-continue-work/);
});

test('emits resume block (without next stage) when activeTask present but no progress.json', () => {
  const root = tmpRoot();
  const ws = path.join(root, '.workflow', 'workspace.json');
  fs.mkdirSync(path.dirname(ws), { recursive: true });
  fs.writeFileSync(ws, JSON.stringify({ activeTask: 'DCL-9999' }));
  const result = runHook(root);
  const parsed = JSON.parse(result.stdout);
  const ctx = parsed.hookSpecificOutput.additionalContext;
  assert.match(ctx, /DCL-9999/);
  assert.match(ctx, /progress\.json/);
});
