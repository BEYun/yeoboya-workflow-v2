const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const { createPagesPayload, createPagesResponse, UUID_SERVER } = require('./fixtures');

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-page-record-')); }

function setupWork(root, workData) {
  const ws = path.join(root, '.workflow', 'workspace.json');
  fs.mkdirSync(path.dirname(ws), { recursive: true });
  fs.writeFileSync(ws, JSON.stringify({ activeWork: 'DCL-1234' }));
  const wf = path.join(root, '.workflow', 'DCL-1234', 'work.json');
  fs.mkdirSync(path.dirname(wf), { recursive: true });
  fs.writeFileSync(wf, JSON.stringify({ work: 'DCL-1234', workType: 'feature', links: {}, ...workData }));
  return wf;
}

function runHook(root, payload) {
  return spawnSync(process.execPath, [path.join(__dirname, '..', 'notion-page-record.js')], {
    env: { ...process.env, DEV_ROOT: root, DEV_LOG_DIR: path.join(root, 'logs') },
    encoding: 'utf8',
    input: JSON.stringify(payload),
  });
}

test('records pageId into links on matching title', () => {
  const root = tmpRoot();
  const wf = setupWork(root, {});
  const inp = createPagesPayload([{ title: '정책서', markdown: '...' }]);
  const result = runHook(root, { ...inp, tool_response: createPagesResponse(['notion-page-abc']) });
  assert.equal(result.status, 0);
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.equal(after.links['write-policy'], 'notion-page-abc');
});

test('records pageId under a UUID server name (PRB-01)', () => {
  // Reproduces the claude.ai connector environment: server segment is a UUID,
  // so the hook must match by the invariant tool-name suffix, not the server.
  const root = tmpRoot();
  const wf = setupWork(root, {});
  const inp = createPagesPayload([{ title: '정책서', markdown: '...' }], { server: UUID_SERVER });
  const result = runHook(root, { ...inp, tool_response: createPagesResponse(['notion-page-uuid']) });
  assert.equal(result.status, 0);
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.equal(after.links['write-policy'], 'notion-page-uuid');
});

test('does not record when title is unknown', () => {
  const root = tmpRoot();
  const wf = setupWork(root, {});
  const inp = createPagesPayload([{ title: '미지의 페이지', markdown: '...' }]);
  runHook(root, { ...inp, tool_response: createPagesResponse(['p-x']) });
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.deepEqual(after.links, {});
});

test('skips silently when no activeWork', () => {
  const root = tmpRoot();
  const inp = createPagesPayload([{ title: '정책서', markdown: '...' }]);
  const result = runHook(root, { ...inp, tool_response: createPagesResponse(['p-x']) });
  assert.equal(result.status, 0);
});

test('skips silently when tool_name is unrelated', () => {
  const root = tmpRoot();
  const wf = setupWork(root, {});
  const result = runHook(root, { tool_name: 'mcp__some-other-tool', tool_input: {}, tool_response: {} });
  assert.equal(result.status, 0);
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.deepEqual(after.links, {});
});

test('multi-page 첫 페이지(데이터 흐름도) → links[draw-data-flow] = {데이터 흐름도}', () => {
  const root = tmpRoot();
  const wf = setupWork(root, {});
  const inp = createPagesPayload([{ title: '데이터 흐름도', markdown: '...' }]);
  const result = runHook(root, { ...inp, tool_response: createPagesResponse(['p-dataflow']) });
  assert.equal(result.status, 0);
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.deepEqual(after.links['draw-data-flow'], { '데이터 흐름도': 'p-dataflow' });
});

test('multi-page 두 번째(통신 명세서) → 두 제목 누적', () => {
  const root = tmpRoot();
  const wf = setupWork(root, { links: { 'draw-data-flow': { '데이터 흐름도': 'p-dataflow' } } });
  const inp = createPagesPayload([{ title: '통신 명세서', markdown: '...' }]);
  runHook(root, { ...inp, tool_response: createPagesResponse(['p-comm']) });
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.deepEqual(after.links['draw-data-flow'], { '데이터 흐름도': 'p-dataflow', '통신 명세서': 'p-comm' });
});

test('기획서 검토(레거시 무버전 제목) → links[write-policy-feedback] 다중 페이지 기록', () => {
  // write-policy-feedback is versioned: links are { title: pageId }, even for
  // the legacy version-less "기획서 검토" title.
  const root = tmpRoot();
  const wf = setupWork(root, {});
  const inp = createPagesPayload([{ title: '기획서 검토', markdown: '...' }]);
  runHook(root, { ...inp, tool_response: createPagesResponse(['p-fb']) });
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.deepEqual(after.links['write-policy-feedback'], { '기획서 검토': 'p-fb' });
});

test('기획서 검토 - 버전별 제목 → links[write-policy-feedback] 버전 누적', () => {
  const root = tmpRoot();
  const wf = setupWork(root, { links: { 'write-policy-feedback': { '기획서 검토 - v0.6': 'p-v6' } } });
  const inp = createPagesPayload([{ title: '기획서 검토 - v0.7', markdown: '...' }]);
  runHook(root, { ...inp, tool_response: createPagesResponse(['p-v7']) });
  const after = JSON.parse(fs.readFileSync(wf, 'utf8'));
  assert.deepEqual(after.links['write-policy-feedback'], {
    '기획서 검토 - v0.6': 'p-v6',
    '기획서 검토 - v0.7': 'p-v7',
  });
});
