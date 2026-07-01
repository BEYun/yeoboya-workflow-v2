'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VALID_CATEGORY = new Set([
  'gate-block', 'wrong-guidance', 'schema-mismatch',
  'ambiguous-form', 'session-break', 'tool-error', 'user-correction',
]);
const VALID_SEVERITY = new Set(['blocker', 'friction', 'nit']);

function workflowDir(root) { return path.join(root, '.workflow'); }
function logPath(root) { return path.join(workflowDir(root), 'improvement-log.jsonl'); }
function markerDir(root) { return path.join(workflowDir(root), '.friction-session'); }
function markerPath(root) { return path.join(markerDir(root), 'pending'); }

function armRecovery(root) {
  try {
    fs.mkdirSync(markerDir(root), { recursive: true });
    fs.writeFileSync(markerPath(root), new Date().toISOString());
  } catch {}
}

function hasPendingRecovery(root) {
  try { return fs.existsSync(markerPath(root)); } catch { return false; }
}

function clearRecovery(root) {
  try { fs.rmSync(markerPath(root), { force: true }); } catch {}
}

function logFriction(root, event) {
  try {
    const source = event.source === 'agent' || event.source === 'user' ? event.source : 'hook';
    const rec = {
      ts: new Date().toISOString(),
      sessionId: event.sessionId ?? null,
      skill: event.skill ?? null,
      workNo: event.workNo ?? null,
      workType: event.workType ?? null,
      category: VALID_CATEGORY.has(event.category) ? event.category : 'tool-error',
      severity: VALID_SEVERITY.has(event.severity) ? event.severity : 'friction',
      what: String(event.what ?? '').slice(0, 500),
      expected: event.expected ? String(event.expected).slice(0, 500) : null,
      source,
    };
    fs.mkdirSync(workflowDir(root), { recursive: true });
    fs.appendFileSync(logPath(root), JSON.stringify(rec) + '\n');
    if (source !== 'agent') armRecovery(root);
    return true;
  } catch {
    return false;
  }
}

function readFrictionLog(root) {
  try {
    const raw = fs.readFileSync(logPath(root), 'utf8');
    return raw.split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  logFriction, readFrictionLog,
  armRecovery, hasPendingRecovery, clearRecovery,
  logPath, markerPath,
};
