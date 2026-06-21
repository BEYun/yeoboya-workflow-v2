#!/usr/bin/env node
'use strict';

const {
  NOTION_WRITE_TOOLS, resolveKey, extractPagesFromInput, extractPageIds, KEY_TO_TITLE,
} = require('./lib/notion');
const { readStdin, allow, log } = require('./lib/hook-runtime');
const { readActiveWork, recordLink } = require('./lib/work');

const MULTI_PAGE_KEY_TITLES = Object.fromEntries(
  Object.entries(KEY_TO_TITLE).filter(([, titles]) => titles.length > 1)
);

(async () => {
  const root = process.env.DEV_ROOT || process.cwd();
  const raw = await readStdin();

  let payload;
  try { payload = JSON.parse(raw); }
  catch { log({ hook: 'page-record', event: 'skip', reason: 'invalid-json' }); return allow(); }

  const toolName = payload?.tool_name || '';
  if (!NOTION_WRITE_TOOLS.has(toolName)) return allow();

  const pages = extractPagesFromInput(toolName, payload.tool_input);
  const ids = extractPageIds(payload.tool_response);

  if (!ids.length) {
    log({ hook: 'page-record', event: 'miss', reason: 'no-page-id-in-response', tool: toolName });
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
      continue;
    }
    const multi = MULTI_PAGE_KEY_TITLES[key] ? { title } : undefined;
    const ok = recordLink(root, work, key, ids[i], multi);
    if (ok) {
      log({ hook: 'page-record', event: 'capture', key, title, pageId: ids[i] });
    } else {
      log({ hook: 'page-record', event: 'skip', reason: 'no-work-json', key });
    }
  }
  return allow();
})();
