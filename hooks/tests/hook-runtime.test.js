const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const rt = require('../lib/hook-runtime');

test('log appends one JSON line with timestamp + fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yb-hook-log-'));
  process.env.DEV_LOG_DIR = dir;
  rt.log({ hook: 'page-record', event: 'capture', stage: 'write-policy' });
  const file = path.join(dir, 'yeoboya-hooks.log');
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.hook, 'page-record');
  assert.equal(parsed.event, 'capture');
  assert.equal(parsed.stage, 'write-policy');
  assert.match(parsed.ts, /\d{4}-\d{2}-\d{2}T/);
  delete process.env.DEV_LOG_DIR;
});

test('log swallows write errors silently', () => {
  process.env.DEV_LOG_DIR = '/dev/null/cannot-be-dir';
  assert.doesNotThrow(() => rt.log({ hook: 'page-record', event: 'pass' }));
  delete process.env.DEV_LOG_DIR;
});

test('readStdin resolves with collected data', async () => {
  const { Readable } = require('node:stream');
  const fakeStdin = Readable.from(['hello', ' ', 'world']);
  const original = Object.getOwnPropertyDescriptor(process, 'stdin');
  Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });
  try {
    const data = await rt.readStdin();
    assert.equal(data, 'hello world');
  } finally {
    Object.defineProperty(process, 'stdin', original);
  }
});
