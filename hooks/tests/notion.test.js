const test = require('node:test');
const assert = require('node:assert/strict');

const notion = require('../lib/notion');
const { createPagesPayload, updatePagePayload, createPagesResponse } = require('./fixtures');

test('NOTION_WRITE_TOOLS includes create-pages and update-page', () => {
  assert.ok(notion.NOTION_WRITE_TOOLS.has('mcp__claude_ai_Notion__notion-create-pages'));
  assert.ok(notion.NOTION_WRITE_TOOLS.has('mcp__claude_ai_Notion__notion-update-page'));
});

test('resolveKey maps "정책서" → write-policy', () => {
  assert.equal(notion.resolveKey('정책서'), 'write-policy');
});

test('resolveKey maps "도메인 명세서" → write-domain', () => {
  assert.equal(notion.resolveKey('도메인 명세서'), 'write-domain');
});

test('resolveKey maps "UI 흐름도" → draw-ui-flow', () => {
  assert.equal(notion.resolveKey('UI 흐름도'), 'draw-ui-flow');
});

test('resolveKey maps "데이터 흐름도" → draw-data-flow', () => {
  assert.equal(notion.resolveKey('데이터 흐름도'), 'draw-data-flow');
});

test('resolveKey maps "QA 시나리오" → write-qa', () => {
  assert.equal(notion.resolveKey('QA 시나리오'), 'write-qa');
});

test('resolveKey returns undefined for unknown title', () => {
  assert.equal(notion.resolveKey('미지의 페이지'), undefined);
  assert.equal(notion.resolveKey(undefined), undefined);
  assert.equal(notion.resolveKey(42), undefined);
});

test('extractPagesFromInput parses create-pages payload', () => {
  const payload = createPagesPayload([
    { title: '정책서', markdown: '# 정책서 본문' }
  ]);
  const pages = notion.extractPagesFromInput(payload.tool_name, payload.tool_input);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].title, '정책서');
  assert.equal(pages[0].markdown, '# 정책서 본문');
});

test('extractPagesFromInput parses update-page replace_content', () => {
  const payload = updatePagePayload({ title: 'UI 흐름도', markdown: '## 변경 본문', command: 'replace_content' });
  const pages = notion.extractPagesFromInput(payload.tool_name, payload.tool_input);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].title, 'UI 흐름도');
  assert.equal(pages[0].markdown, '## 변경 본문');
});

test('extractPageIds extracts ids from create-pages response array', () => {
  const r = createPagesResponse(['p-1', 'p-2']);
  assert.deepEqual(notion.extractPageIds(r), ['p-1', 'p-2']);
});

test('extractPageIds extracts single id from update-page response', () => {
  assert.deepEqual(notion.extractPageIds({ id: 'p-3' }), ['p-3']);
});

test('extractPageIds returns empty array on malformed response', () => {
  assert.deepEqual(notion.extractPageIds(null), []);
  assert.deepEqual(notion.extractPageIds('not-json'), []);
});

test('resolveKey maps "기획서 검토" → write-policy-feedback', () => {
  assert.equal(notion.resolveKey('기획서 검토'), 'write-policy-feedback');
});

test('resolveKey maps "통신 명세서" → draw-data-flow', () => {
  assert.equal(notion.resolveKey('통신 명세서'), 'draw-data-flow');
});

test('KEY_TO_TITLE is exported from notion', () => {
  assert.ok(typeof notion.KEY_TO_TITLE === 'object' && notion.KEY_TO_TITLE !== null);
});

test('KEY_TO_TITLE draw-data-flow has exactly 2 titles', () => {
  assert.deepEqual(notion.KEY_TO_TITLE['draw-data-flow'], ['데이터 흐름도', '통신 명세서']);
});

test('KEY_TO_TITLE write-policy has exactly 1 title', () => {
  assert.deepEqual(notion.KEY_TO_TITLE['write-policy'], ['정책서']);
});
