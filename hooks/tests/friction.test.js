const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { logFriction, readFrictionLog, hasPendingRecovery, clearRecovery, logPath } = require('../lib/friction');

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-friction-')); }

test('logFriction appends a normalized line and arms recovery', () => {
  const root = tmpRoot();
  const ok = logFriction(root, { skill: 'yeoboya-write-code', category: 'gate-block', severity: 'blocker', what: '데이터 흐름도 없음', source: 'hook' });
  assert.equal(ok, true);
  const lines = readFrictionLog(root);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].category, 'gate-block');
  assert.equal(lines[0].severity, 'blocker');
  assert.equal(lines[0].source, 'hook');
  assert.equal(typeof lines[0].ts, 'string');
  assert.equal(hasPendingRecovery(root), true);
});

test('agent-source does NOT arm recovery', () => {
  const root = tmpRoot();
  logFriction(root, { category: 'wrong-guidance', what: 'x', source: 'agent' });
  assert.equal(hasPendingRecovery(root), false);
});

test('invalid category/severity fall back to safe defaults', () => {
  const root = tmpRoot();
  logFriction(root, { category: 'bogus', severity: 'nope', what: 'y', source: 'hook' });
  const [e] = readFrictionLog(root);
  assert.equal(e.category, 'tool-error');
  assert.equal(e.severity, 'friction');
});

test('spec-change is a valid category (edit-work 변경 전파 기록)', () => {
  const root = tmpRoot();
  logFriction(root, { category: 'spec-change', skill: 'yeoboya-edit-work', what: '검색 필터에 지역 조건 추가', source: 'agent' });
  const [e] = readFrictionLog(root);
  assert.equal(e.category, 'spec-change');
  assert.equal(e.source, 'agent');
  assert.equal(hasPendingRecovery(root), false);
});

test('clearRecovery removes the marker', () => {
  const root = tmpRoot();
  logFriction(root, { category: 'tool-error', what: 'z', source: 'hook' });
  clearRecovery(root);
  assert.equal(hasPendingRecovery(root), false);
});

test('readFrictionLog returns [] when no log', () => {
  const root = tmpRoot();
  assert.deepEqual(readFrictionLog(root), []);
  assert.match(logPath(root), /improvement-log\.jsonl$/);
});
