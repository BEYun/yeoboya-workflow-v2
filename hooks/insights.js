#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readFrictionLog } = require('./lib/friction');
const { aggregate } = require('./lib/insights');
const { buildInsightsHtml } = require('./lib/insights-html');

(async () => {
  const root = process.env.DEV_ROOT || process.cwd();
  const mode = process.argv[2] || 'html';
  const data = aggregate(readFrictionLog(root));

  if (mode === 'aggregate') {
    process.stdout.write(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  let narrative = '';
  const nf = process.argv[3];
  if (nf) { try { narrative = fs.readFileSync(nf, 'utf8'); } catch {} }

  const out = path.join(root, '.workflow', 'insights.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildInsightsHtml(data, narrative));
  process.stdout.write(out + '\n');
  process.exit(0);
})();
