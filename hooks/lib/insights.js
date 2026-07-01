'use strict';

const SEVERITY_WEIGHT = { blocker: 5, friction: 2, nit: 1 };

function aggregate(events) {
  const list = Array.isArray(events) ? events : [];
  const pareto = {};
  const categoryDist = {};
  const severityBySkill = {};
  const bias = { hook: 0, agent: 0 };
  const trend = {};

  for (const e of list) {
    const skill = e.skill || 'unknown';
    const category = e.category || 'unknown';
    const severity = e.severity || 'friction';
    const w = SEVERITY_WEIGHT[severity] ?? 2;

    const pk = skill + '|' + category;
    pareto[pk] = pareto[pk] || { skill, category, count: 0, score: 0 };
    pareto[pk].count += 1;
    pareto[pk].score += w;

    categoryDist[category] = (categoryDist[category] || 0) + 1;

    severityBySkill[skill] = severityBySkill[skill] || { blocker: 0, friction: 0, nit: 0 };
    if (severityBySkill[skill][severity] !== undefined) severityBySkill[skill][severity] += 1;

    if (e.source === 'agent') bias.agent += 1; else bias.hook += 1;

    const day = typeof e.ts === 'string' ? e.ts.slice(0, 10) : '';
    if (day) trend[day] = (trend[day] || 0) + 1;
  }

  return {
    total: list.length,
    pareto: Object.values(pareto).sort((a, b) => b.score - a.score),
    categoryDist,
    severityBySkill,
    bias,
    trend: Object.entries(trend).sort().map(([date, count]) => ({ date, count })),
  };
}

module.exports = { aggregate, SEVERITY_WEIGHT };
