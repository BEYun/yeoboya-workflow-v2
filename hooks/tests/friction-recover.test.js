const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { logFriction, hasPendingRecovery } = require('../lib/friction');

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-recover-')); }
function run(root, payload) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'friction-recover.js')], {
    env: { ...process.env, DEV_ROOT: root }, encoding: 'utf8', input: JSON.stringify(payload || {}),
  });
}

test('no marker -> passes silently (exit 0)', () => {
  const root = tmpRoot();
  const r = run(root, {});
  assert.equal(r.status, 0);
  assert.equal(r.stderr.trim(), '');
});

test('pending marker -> blocks once with prompt, then clears marker', () => {
  const root = tmpRoot();
  logFriction(root, { category: 'gate-block', skill: 'yeoboya-select-subtask', what: 'x', source: 'hook' });
  assert.equal(hasPendingRecovery(root), true);
  const r = run(root, {});
  assert.equal(r.status, 2);
  assert.match(r.stderr, /gate-block/);
  assert.equal(hasPendingRecovery(root), false);
});

test('stop_hook_active guard -> passes even with marker', () => {
  const root = tmpRoot();
  logFriction(root, { category: 'tool-error', what: 'x', source: 'hook' });
  const r = run(root, { stop_hook_active: true });
  assert.equal(r.status, 0);
});
