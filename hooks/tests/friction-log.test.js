const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { readFrictionLog } = require('../lib/friction');

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-friction-cli-')); }
function run(root, args, input) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'friction-log.js'), ...args], {
    env: { ...process.env, DEV_ROOT: root }, encoding: 'utf8', input: input || '',
  });
}

test('records event from stdin JSON', () => {
  const root = tmpRoot();
  const r = run(root, [], JSON.stringify({ category: 'gate-block', skill: 'yeoboya-select-subtask', severity: 'friction', what: 'feature 필수문서 누락', source: 'hook' }));
  assert.equal(r.status, 0);
  const [e] = readFrictionLog(root);
  assert.equal(e.category, 'gate-block');
  assert.equal(e.skill, 'yeoboya-select-subtask');
});

test('records event from argv shorthand', () => {
  const root = tmpRoot();
  const r = run(root, ['tool-error', 'yeoboya-publish-notion', '노션', '전송', '실패'], '');
  assert.equal(r.status, 0);
  const [e] = readFrictionLog(root);
  assert.equal(e.category, 'tool-error');
  assert.equal(e.what, '노션 전송 실패');
});
