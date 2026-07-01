#!/usr/bin/env node
'use strict';

const {
  isNotionWriteTool, resolveKey, extractPagesFromInput, extractPageIds, isMultiPageKey,
} = require('./lib/notion');
const { readStdin, allow, log } = require('./lib/hook-runtime');
const { readActiveWork, recordLink } = require('./lib/work');
const { logFriction } = require('./lib/friction');

(async () => {
  const root = process.env.DEV_ROOT || process.cwd();
  const raw = await readStdin();

  let payload;
  try { payload = JSON.parse(raw); }
  catch { log({ hook: 'page-record', event: 'skip', reason: 'invalid-json' }); return allow(); }

  const toolName = payload?.tool_name || '';
  if (!isNotionWriteTool(toolName)) return allow();

  const pages = extractPagesFromInput(toolName, payload.tool_input);
  const ids = extractPageIds(payload.tool_response);

  if (!ids.length) {
    // Capture net: if extraction still misses, record the real response shape
    // (truncated) so an unseen envelope variant can be pinned without guessing.
    let shape;
    try { shape = JSON.stringify(payload.tool_response).slice(0, 400); }
    catch { shape = String(payload.tool_response).slice(0, 400); }
    log({ hook: 'page-record', event: 'miss', reason: 'no-page-id-in-response', tool: toolName, shape });
    logFriction(root, { skill: 'yeoboya-publish-notion', category: 'tool-error', severity: 'friction', what: '노션 응답에서 pageId 추출 실패', sessionId: payload?.session_id ?? null, source: 'hook' });
    return allow();
  }

  const work = readActiveWork(root);
  if (!work) {
    log({ hook: 'page-record', event: 'skip', reason: 'no-active-work' });
    return allow();
  }

  const len = Math.min(pages.length, ids.length);
  for (let i = 0; i < len; i++) {
    const title = pages[i].title;
    const key = resolveKey(title);
    if (!key) {
      log({ hook: 'page-record', event: 'skip', reason: 'unknown-title', title });
      logFriction(root, { skill: 'yeoboya-publish-notion', category: 'schema-mismatch', severity: 'nit', what: `알 수 없는 문서 제목: ${title}`, sessionId: payload?.session_id ?? null, source: 'hook' });
      continue;
    }
    const multi = isMultiPageKey(key) ? { title } : undefined;
    const ok = recordLink(root, work, key, ids[i], multi);
    if (ok) {
      log({ hook: 'page-record', event: 'capture', key, title, pageId: ids[i] });
    } else {
      log({ hook: 'page-record', event: 'skip', reason: 'no-work-json', key });
    }
  }
  return allow();
})();
