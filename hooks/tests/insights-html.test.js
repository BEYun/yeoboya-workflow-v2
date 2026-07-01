const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { buildInsightsHtml } = require('../lib/insights-html');
const { aggregate } = require('../lib/insights');

test('buildInsightsHtml embeds data, chart.js, 5 canvases, narrative', () => {
  const data = aggregate([{ ts: '2026-06-01T00:00:00Z', skill: 's', category: 'gate-block', severity: 'blocker', source: 'hook' }]);
  const html = buildInsightsHtml(data, '<p>재발 모드: 예시</p>');
  assert.match(html, /chart\.js/i);
  assert.match(html, /gate-block/);
  for (const id of ['chartPareto', 'chartCategory', 'chartSeverity', 'chartBias', 'chartTrend']) {
    assert.ok(html.includes(id), 'missing canvas ' + id);
  }
  assert.match(html, /재발 모드: 예시/);
});

test('CLI aggregate prints JSON from the log', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yb-insights-cli-'));
  const { logFriction } = require('../lib/friction');
  logFriction(root, { skill: 's', category: 'gate-block', severity: 'blocker', source: 'hook' });
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'insights.js'), 'aggregate'], {
    env: { ...process.env, DEV_ROOT: root }, encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  const d = JSON.parse(r.stdout);
  assert.equal(d.total, 1);
});

test('CLI html writes insights.html', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yb-insights-html-'));
  const { logFriction } = require('../lib/friction');
  logFriction(root, { skill: 's', category: 'tool-error', severity: 'friction', source: 'hook' });
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'insights.js'), 'html'], {
    env: { ...process.env, DEV_ROOT: root }, encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(path.join(root, '.workflow', 'insights.html')));
});
