'use strict';

const NOTION_WRITE_TOOLS = new Set([
  'mcp__claude_ai_Notion__notion-create-pages',
  'mcp__claude_ai_Notion__notion-update-page',
]);

const { TITLE_TO_KEY: TITLE_TO_KEY_OBJ, KEY_TO_TITLE } = require('./constants.json');
const TITLE_TO_KEY = new Map(Object.entries(TITLE_TO_KEY_OBJ));

function resolveKey(title) {
  if (typeof title !== 'string') return undefined;
  return TITLE_TO_KEY.get(title.trim());
}

function normalizeTitle(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

function pickTitle(p) {
  return normalizeTitle(p?.properties?.title ?? p?.title ?? p?.name ?? '');
}

function extractPagesFromInput(toolName, toolInput) {
  if (!toolInput) return [];
  if (toolName === 'mcp__claude_ai_Notion__notion-create-pages') {
    const raw = Array.isArray(toolInput.pages)
      ? toolInput.pages
      : toolInput.page ? [toolInput.page] : [];
    return raw.map((p) => ({
      title: pickTitle(p),
      markdown: typeof p?.content === 'string' ? p.content : '',
    }));
  }
  if (toolName === 'mcp__claude_ai_Notion__notion-update-page') {
    const cmd = toolInput?.command;
    let markdown = null;
    if (cmd === 'replace_content' && typeof toolInput?.new_str === 'string') {
      markdown = toolInput.new_str;
    } else if (cmd === 'update_content' && Array.isArray(toolInput?.content_updates)) {
      markdown = toolInput.content_updates
        .map((u) => (typeof u?.new_str === 'string' ? u.new_str : ''))
        .join('\n');
    }
    const title = normalizeTitle(toolInput?.properties?.title ?? toolInput?.title ?? '');
    return [{ title, markdown }];
  }
  return [];
}

function extractPageIds(toolResponse) {
  let r = toolResponse;
  if (typeof r === 'string') {
    try { r = JSON.parse(r); } catch { return []; }
  }
  if (!r || typeof r !== 'object') return [];
  if (Array.isArray(r.results) && r.results.length) {
    return r.results.map((x) => x?.id).filter(Boolean);
  }
  const single = r.id ?? r.page_id;
  return single ? [single] : [];
}

module.exports = {
  NOTION_WRITE_TOOLS,
  TITLE_TO_KEY,
  KEY_TO_TITLE,
  resolveKey,
  extractPagesFromInput,
  extractPageIds,
};
