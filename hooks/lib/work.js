'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveKey, isMultiPageKey } = require('./notion');

function workspacePath(root) {
  return path.join(root, '.workflow', 'workspace.json');
}

function workPath(root, work) {
  return path.join(root, '.workflow', work, 'work.json');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function atomicWrite(filePath, contents) {
  ensureDir(path.dirname(filePath));
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, filePath);
}

function readWorkspace(root) {
  try {
    return JSON.parse(fs.readFileSync(workspacePath(root), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

function readActiveWork(root) {
  const cfg = readWorkspace(root);
  if (!cfg) return null;
  const v = typeof cfg.activeWork === 'string' ? cfg.activeWork.trim() : '';
  return v || null;
}

function readWork(root, work) {
  try {
    return JSON.parse(fs.readFileSync(workPath(root, work), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

function safeWriteWork(root, work, data) {
  try {
    atomicWrite(workPath(root, work), JSON.stringify(data, null, 2) + '\n');
    return true;
  } catch (e) {
    try {
      const { log } = require('./hook-runtime');
      log({ hook: 'work', event: 'write-error', work, message: String(e?.message || e) });
    } catch {}
    try {
      const { logFriction } = require('./friction');
      logFriction(root, { workNo: work, category: 'session-break', severity: 'blocker', what: 'work.json 쓰기 실패 — 진행 상태 유실 위험', source: 'hook' });
    } catch {}
    process.stderr.write(`[work] write failed: ${e?.message || e}\n`);
    return false;
  }
}

function setLink(links, key, pageId, multiTitle) {
  if (!multiTitle) {
    links[key] = pageId;
    return;
  }
  const existing = (links[key] && typeof links[key] === 'object') ? links[key] : {};
  existing[multiTitle] = pageId;
  links[key] = existing;
}

function recordLink(root, work, key, notionPageId, multi) {
  const w = readWork(root, work);
  if (!w) return false;
  w.links = w.links || {};
  setLink(w.links, key, notionPageId, multi && multi.title);
  return safeWriteWork(root, work, w);
}

function syncLinks(root, work, children) {
  const w = readWork(root, work);
  if (!w) return null;
  w.links = w.links || {};
  const list = Array.isArray(children) ? children : [];
  for (const c of list) {
    if (!c || typeof c.id !== 'string' || !c.id) continue;
    const title = typeof c.title === 'string' ? c.title : '';
    const key = resolveKey(title);
    if (!key) continue;
    setLink(w.links, key, c.id, isMultiPageKey(key) ? title.trim() : null);
  }
  return safeWriteWork(root, work, w) ? w.links : null;
}

module.exports = { readActiveWork, readWork, recordLink, syncLinks };
