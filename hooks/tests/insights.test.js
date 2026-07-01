const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregate } = require('../lib/insights');

const EVENTS = [
  { ts: '2026-06-01T00:00:00Z', skill: 'yeoboya-write-code', category: 'gate-block', severity: 'blocker', source: 'hook' },
  { ts: '2026-06-01T01:00:00Z', skill: 'yeoboya-write-code', category: 'gate-block', severity: 'friction', source: 'hook' },
  { ts: '2026-06-02T00:00:00Z', skill: 'yeoboya-publish-notion', category: 'tool-error', severity: 'friction', source: 'agent' },
];

test('pareto sorts by weighted score desc', () => {
  const d = aggregate(EVENTS);
  assert.equal(d.total, 3);
  assert.equal(d.pareto[0].skill, 'yeoboya-write-code');
  assert.equal(d.pareto[0].category, 'gate-block');
  assert.equal(d.pareto[0].score, 7); // 5 + 2
  assert.equal(d.pareto[0].count, 2);
});

test('category distribution and bias counts', () => {
  const d = aggregate(EVENTS);
  assert.equal(d.categoryDist['gate-block'], 2);
  assert.equal(d.categoryDist['tool-error'], 1);
  assert.equal(d.bias.hook, 2);
  assert.equal(d.bias.agent, 1);
});

test('severityBySkill and trend by day', () => {
  const d = aggregate(EVENTS);
  assert.equal(d.severityBySkill['yeoboya-write-code'].blocker, 1);
  assert.equal(d.severityBySkill['yeoboya-write-code'].friction, 1);
  assert.deepEqual(d.trend, [{ date: '2026-06-01', count: 2 }, { date: '2026-06-02', count: 1 }]);
});

test('empty input yields zeros', () => {
  const d = aggregate([]);
  assert.equal(d.total, 0);
  assert.deepEqual(d.pareto, []);
  assert.deepEqual(d.trend, []);
});
