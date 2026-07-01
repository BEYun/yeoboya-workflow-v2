#!/usr/bin/env node
'use strict';

const { readStdin } = require('./lib/hook-runtime');
const { logFriction } = require('./lib/friction');

(async () => {
  const root = process.env.DEV_ROOT || process.cwd();
  const raw = await readStdin();

  let event = {};
  try { event = raw ? JSON.parse(raw) : {}; } catch { event = {}; }

  if (process.argv[2] && !event.category) {
    event.category = process.argv[2];
    if (process.argv[3]) event.skill = process.argv[3];
    const rest = process.argv.slice(4);
    if (rest.length) event.what = rest.join(' ');
  }

  logFriction(root, event);
  process.exit(0);
})();
