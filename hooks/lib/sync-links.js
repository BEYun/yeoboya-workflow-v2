#!/usr/bin/env node
'use strict';

const { readStdin, log } = require('./hook-runtime');
const { syncLinks } = require('./work');
const { logFriction } = require('./friction');

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
  process.exit(0);
}

(async () => {
  const work = process.argv[2];
  if (!work) {
    process.stderr.write('usage: sync-links.js <work>\n');
    process.exit(1);
  }
  const root = process.env.DEV_ROOT || process.cwd();
  const raw = await readStdin();

  let children;
  try { children = JSON.parse(raw); }
  catch {
    log({ hook: 'sync-links', event: 'skip', reason: 'invalid-json', work });
    logFriction(root, { skill: 'yeoboya-publish-notion', workNo: work, category: 'schema-mismatch', severity: 'friction', what: 'sync-links 입력이 JSON이 아님', source: 'hook' });
    return out({});
  }
  if (!Array.isArray(children)) children = [];

  const links = syncLinks(root, work, children);
  if (links === null) {
    log({ hook: 'sync-links', event: 'skip', reason: 'no-work-json', work });
    logFriction(root, { skill: 'yeoboya-publish-notion', workNo: work, category: 'schema-mismatch', severity: 'friction', what: 'work.json 없음 — links 동기화 불가', source: 'hook' });
    return out({});
  }
  log({ hook: 'sync-links', event: 'sync', work, count: children.length });
  return out(links);
})();
