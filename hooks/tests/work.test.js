const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const work = require('../lib/work');

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'yb-work-')); }
function workspaceFile(root) { return path.join(root, '.workflow', 'workspace.json'); }
function workFile(root, w) { return path.join(root, '.workflow', w, 'work.json'); }

test('readActiveWork returns null when workspace.json absent', () => {
  assert.equal(work.readActiveWork(tmpRoot()), null);
});

test('readActiveWork returns activeWork value', () => {
  const root = tmpRoot();
  fs.mkdirSync(path.dirname(workspaceFile(root)), { recursive: true });
  fs.writeFileSync(workspaceFile(root), JSON.stringify({ activeWork: 'DCL-1234' }));
  assert.equal(work.readActiveWork(root), 'DCL-1234');
});

test('readWork returns null when work.json absent', () => {
  assert.equal(work.readWork(tmpRoot(), 'DCL-X'), null);
});

test('readWork parses work.json', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-1234');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-1234', links: {} }));
  assert.equal(work.readWork(root, 'DCL-1234').work, 'DCL-1234');
});

test('recordLink writes single pageId into links[key]', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-1234');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-1234', links: {} }));
  assert.equal(work.recordLink(root, 'DCL-1234', 'write-policy', 'p-1'), true);
  const after = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(after.links['write-policy'], 'p-1');
});

test('recordLink returns false when work.json absent', () => {
  assert.equal(work.recordLink(tmpRoot(), 'DCL-X', 'write-policy', 'p-1'), false);
});

test('recordLink initializes links when missing', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-1234');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-1234' }));
  work.recordLink(root, 'DCL-1234', 'write-policy', 'p-1');
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).links['write-policy'], 'p-1');
});

test('recordLink multi-page accumulates { title: pageId }', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-1');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-1', links: {} }));
  work.recordLink(root, 'DCL-1', 'draw-data-flow', 'p-1', { title: '데이터 흐름도' });
  work.recordLink(root, 'DCL-1', 'draw-data-flow', 'p-2', { title: '통신 명세서' });
  const after = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.deepEqual(after.links['draw-data-flow'], { '데이터 흐름도': 'p-1', '통신 명세서': 'p-2' });
});

test('syncLinks maps child titles to keys and writes links', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-2');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-2', links: {} }));
  const links = work.syncLinks(root, 'DCL-2', [
    { title: '정책서', id: 'p-pol' },
    { title: 'UI 흐름도', id: 'p-ui' },
  ]);
  assert.equal(links['write-policy'], 'p-pol');
  assert.equal(links['draw-ui-flow'], 'p-ui');
  const after = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(after.links['write-policy'], 'p-pol');
});

test('syncLinks accumulates multi-page draw-data-flow', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-3');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-3', links: {} }));
  const links = work.syncLinks(root, 'DCL-3', [
    { title: '데이터 흐름도', id: 'p-df' },
    { title: '통신 명세서', id: 'p-cs' },
  ]);
  assert.deepEqual(links['draw-data-flow'], { '데이터 흐름도': 'p-df', '통신 명세서': 'p-cs' });
});

test('syncLinks preserves unmatched existing keys and skips unknown titles', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-4');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-4', links: { 'write-qa': 'p-qa' } }));
  const links = work.syncLinks(root, 'DCL-4', [
    { title: '정책서', id: 'p-pol' },
    { title: '엉뚱한 제목', id: 'p-x' },
  ]);
  assert.equal(links['write-qa'], 'p-qa');
  assert.equal(links['write-policy'], 'p-pol');
  assert.equal(links['엉뚱한 제목'], undefined);
});

test('syncLinks returns null when work.json absent', () => {
  assert.equal(work.syncLinks(tmpRoot(), 'DCL-X', [{ title: '정책서', id: 'p' }]), null);
});

test('syncLinks ignores children without id', () => {
  const root = tmpRoot();
  const f = workFile(root, 'DCL-5');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ work: 'DCL-5', links: {} }));
  const links = work.syncLinks(root, 'DCL-5', [{ title: '정책서' }, { title: 'UI 흐름도', id: 'p-ui' }]);
  assert.equal(links['write-policy'], undefined);
  assert.equal(links['draw-ui-flow'], 'p-ui');
});
