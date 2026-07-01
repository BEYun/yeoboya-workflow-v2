'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { readFrictionLog } = require('../lib/friction');

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-wiring-')); }

test('sync-links no-work-json records a schema-mismatch friction', () => {
  const root = tmpRoot();
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'lib', 'sync-links.js'), 'DCL-1'], {
    env: { ...process.env, DEV_ROOT: root, DEV_LOG_DIR: path.join(root, 'logs') },
    encoding: 'utf8', input: JSON.stringify([]),
  });
  assert.equal(r.status, 0);
  const events = readFrictionLog(root);
  assert.equal(events.length, 1);
  assert.equal(events[0].skill, 'yeoboya-publish-notion');
  assert.equal(events[0].category, 'schema-mismatch');
});

test('notion-page-record miss (no page id) records a tool-error friction', () => {
  const root = tmpRoot();
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'notion-page-record.js')], {
    env: { ...process.env, DEV_ROOT: root, DEV_LOG_DIR: path.join(root, 'logs') },
    encoding: 'utf8',
    input: JSON.stringify({ tool_name: 'mcp__x__notion-create-pages', tool_input: {}, tool_response: {} }),
  });
  assert.equal(r.status, 0);
  const events = readFrictionLog(root);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, 'tool-error');
});
