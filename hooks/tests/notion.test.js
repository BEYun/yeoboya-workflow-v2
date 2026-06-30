const test = require('node:test');
const assert = require('node:assert/strict');

const notion = require('../lib/notion');
const {
  createPagesPayload, updatePagePayload, createPagesResponse, notionTool,
  NAMED_SERVER, UUID_SERVER,
} = require('./fixtures');

test('isNotionWriteTool matches create/update under a named server (PRB-01)', () => {
  assert.equal(notion.isNotionWriteTool(notionTool('notion-create-pages', NAMED_SERVER)), true);
  assert.equal(notion.isNotionWriteTool(notionTool('notion-update-page', NAMED_SERVER)), true);
});

test('isNotionWriteTool matches create/update under a UUID server (PRB-01)', () => {
  // claude.ai connector assigns a UUID server name; the suffix is invariant.
  assert.equal(notion.isNotionWriteTool(notionTool('notion-create-pages', UUID_SERVER)), true);
  assert.equal(notion.isNotionWriteTool(notionTool('notion-update-page', UUID_SERVER)), true);
});

test('isNotionWriteTool rejects non-write Notion tools and foreign tools', () => {
  assert.equal(notion.isNotionWriteTool(notionTool('notion-search', UUID_SERVER)), false);
  assert.equal(notion.isNotionWriteTool(notionTool('notion-fetch', UUID_SERVER)), false);
  assert.equal(notion.isNotionWriteTool('mcp__other__create-pages'), false);
  assert.equal(notion.isNotionWriteTool('notion-create-pages'), false); // no mcp__/server structure
  assert.equal(notion.isNotionWriteTool('mcp____notion-create-pages'), false); // empty server segment
  assert.equal(notion.isNotionWriteTool(undefined), false);
});

test('notionToolKind classifies create vs update regardless of server', () => {
  assert.equal(notion.notionToolKind(notionTool('notion-create-pages', UUID_SERVER)), 'create');
  assert.equal(notion.notionToolKind(notionTool('notion-update-page', UUID_SERVER)), 'update');
  assert.equal(notion.notionToolKind(notionTool('notion-search', UUID_SERVER)), null);
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

test('extractPagesFromInput parses create-pages under a UUID server (PRB-01)', () => {
  const payload = createPagesPayload([{ title: '정책서', markdown: '# 본문' }], { server: UUID_SERVER });
  const pages = notion.extractPagesFromInput(payload.tool_name, payload.tool_input);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].title, '정책서');
  assert.equal(pages[0].markdown, '# 본문');
});

test('extractPagesFromInput parses update-page under a UUID server (PRB-01)', () => {
  const payload = updatePagePayload({ title: 'UI 흐름도', markdown: '## 변경', server: UUID_SERVER });
  const pages = notion.extractPagesFromInput(payload.tool_name, payload.tool_input);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].title, 'UI 흐름도');
  assert.equal(pages[0].markdown, '## 변경');
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

test('resolveKey maps versioned "기획서 검토 - v0.7" → write-policy-feedback (prefix)', () => {
  assert.equal(notion.resolveKey('기획서 검토 - v0.7'), 'write-policy-feedback');
  assert.equal(notion.resolveKey('기획서 검토 - 2026-06-30 draft'), 'write-policy-feedback');
});

test('resolveKey does NOT match the row heading "기획서 검토 결과"', () => {
  // The heading_2 lives on the row body, not as a child page; it must never
  // resolve to a key (otherwise sync-links would mis-record it).
  assert.equal(notion.resolveKey('기획서 검토 결과'), undefined);
});

test('isMultiPageKey: versioned + fixed-multi keys are multi, single keys are not', () => {
  assert.equal(notion.isMultiPageKey('write-policy-feedback'), true); // versioned
  assert.equal(notion.isMultiPageKey('draw-data-flow'), true);        // 2 fixed titles
  assert.equal(notion.isMultiPageKey('write-policy'), false);         // single
  assert.equal(notion.isMultiPageKey('write-qa'), false);            // single
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

test('resolveKey maps "버그 분석" → analyze-bug', () => {
  assert.equal(notion.resolveKey('버그 분석'), 'analyze-bug');
});

test('KEY_TO_TITLE analyze-bug has exactly 1 title', () => {
  assert.deepEqual(notion.KEY_TO_TITLE['analyze-bug'], ['버그 분석']);
});
