'use strict';

function buildInsightsHtml(data, narrativeHtml) {
  const json = JSON.stringify(data);
  const narrative = narrativeHtml || '<p style="color:#888">원인 분석 서술이 아직 없습니다.</p>';
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>작업 불편 분석</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 960px; margin: 24px auto; padding: 0 16px; color: #222; }
  h1 { font-size: 20px; font-weight: 500; } h2 { font-size: 16px; font-weight: 500; margin-top: 28px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 14px; }
  .muted { color: #888; font-size: 13px; }
</style></head>
<body>
  <h1>작업 불편 분석 <span class="muted">· 기록 ${data.total}건</span></h1>
  <h2>1 · 무엇부터 고칠까</h2>
  <div class="card"><canvas id="chartPareto" height="140"></canvas></div>
  <div class="grid">
    <div class="card"><h2>2 · 불편 종류 비중</h2><canvas id="chartCategory" height="180"></canvas></div>
    <div class="card"><h2>3 · 심각도 구성</h2><canvas id="chartSeverity" height="180"></canvas></div>
    <div class="card"><h2>4 · 놓친 불편 (자동 vs 사람)</h2><canvas id="chartBias" height="180"></canvas></div>
    <div class="card"><h2>5 · 추이</h2><canvas id="chartTrend" height="180"></canvas></div>
  </div>
  <h2>원인 분석 — 반복되는 불편 → 고칠 파일</h2>
  <div class="card">${narrative}</div>
  <script>
    const DATA = ${json};
    const topPareto = DATA.pareto.slice(0, 10);
    new Chart(chartPareto, { type: 'bar', data: { labels: topPareto.map(p => p.skill + ' · ' + p.category), datasets: [{ label: '가중 점수', data: topPareto.map(p => p.score) }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } });
    const cats = Object.keys(DATA.categoryDist);
    new Chart(chartCategory, { type: 'doughnut', data: { labels: cats, datasets: [{ data: cats.map(c => DATA.categoryDist[c]) }] } });
    const skills = Object.keys(DATA.severityBySkill);
    new Chart(chartSeverity, { type: 'bar', data: { labels: skills, datasets: [
      { label: '막힘', data: skills.map(s => DATA.severityBySkill[s].blocker) },
      { label: '불편', data: skills.map(s => DATA.severityBySkill[s].friction) },
      { label: '사소', data: skills.map(s => DATA.severityBySkill[s].nit) },
    ] }, options: { scales: { x: { stacked: true }, y: { stacked: true } } } });
    new Chart(chartBias, { type: 'bar', data: { labels: ['자동 기록', '사람 기록'], datasets: [{ data: [DATA.bias.hook, DATA.bias.agent] }] }, options: { plugins: { legend: { display: false } } } });
    new Chart(chartTrend, { type: 'line', data: { labels: DATA.trend.map(t => t.date), datasets: [{ label: '불편 발생', data: DATA.trend.map(t => t.count) }] } });
  </script>
</body></html>`;
}

module.exports = { buildInsightsHtml };
