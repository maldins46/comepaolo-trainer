import { weekAxis, chartDefaults, makeChart, theme, axisTitle, chartTitle } from '../lib/charts.js';

export function render(container, ctx) {
  const { data } = ctx;
  const maxWeek = data.cycle.weeks;
  const { beforeBreakMinutes, onReturnMinutes } = data.runningBaseline;
  const t = theme();

  const missing = data.weeks
    .filter((w) => w.state !== 'future' && !w.run)
    .map((w) => 'S' + w.week);
  const latest = [...data.weeks].reverse().find((w) => w.run);
  const block3 = data.weeks.find((w) => w.runTargetMinutes);
  const beforeBreakPace = beforeBreakMinutes / 10;
  const block3TargetPace = block3 ? block3.runTargetMinutes / 10 : null;

  container.innerHTML = `
    <h1>Running</h1>
    <p class="hint">Pace (minutes per km) is already distance-independent, so it's directly comparable
    week to week even though the Sunday run's distance changes across the cycle (7-8km early on,
    6-7km during the deload) — shown here together, pace as bars, distance as the line.</p>
    <div class="tiles">
      <div class="tile"><h3>Latest pace</h3><span class="big">${latest ? latest.run.paceMinPerKm.toFixed(2) + '/km' : '—'}</span><p>${latest ? 'S' + latest.week : 'no run logged yet'}</p></div>
      <div class="tile"><h3>Latest distance</h3><span class="big">${latest ? latest.run.km + 'km' : '—'}</span><p>${latest ? 'S' + latest.week : 'no run logged yet'}</p></div>
      <div class="tile"><h3>Pre-break pace</h3><span class="big">${beforeBreakPace.toFixed(2)}/km</span><p>before the cycle</p></div>
      ${block3TargetPace ? `<div class="tile"><h3>Block 3 target</h3><span class="big">${block3TargetPace.toFixed(2)}/km</span><p>weeks 9-11</p></div>` : ''}
    </div>
    <div class="chart-wrap tall"><canvas id="run-chart"></canvas></div>
    ${missing.length ? `<p class="muted">No run logged: ${missing.join(', ')}</p>` : ''}
  `;

  const actual = data.weeks.map((w) => ({ x: w.week, y: w.run ? +w.run.paceMinPerKm.toFixed(2) : null }));
  const distance = data.weeks.map((w) => ({ x: w.week, y: w.run?.km ?? null }));
  const goalPace = [{ x: 1, y: +beforeBreakPace.toFixed(2) }, { x: maxWeek, y: +beforeBreakPace.toFixed(2) }];

  const chart = makeChart(document.getElementById('run-chart'), {
    type: 'bar',
    data: {
      datasets: [
        { type: 'bar', label: 'Actual pace', data: actual, backgroundColor: t.accent, borderRadius: 3, yAxisID: 'y', unit: '/km', order: 0 },
        { type: 'line', label: 'Distance', data: distance, borderColor: t.warn, backgroundColor: t.warn, borderWidth: 3, pointRadius: 4, spanGaps: false, yAxisID: 'y1', unit: 'km', order: 1 },
        { type: 'line', label: 'Pre-break pace (goal)', data: goalPace, borderColor: t.done, borderDash: [5, 4], pointRadius: 0, yAxisID: 'y', unit: '/km', order: 2 },
      ],
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: weekAxis(maxWeek, { title: 'Week' }),
        y: { position: 'left', reverse: false, beginAtZero: true, suggestedMax: 12, grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Pace (min/km)') },
        y1: { position: 'right', beginAtZero: true, suggestedMax: 12, grid: { drawOnChartArea: false }, ticks: { color: t.muted }, title: axisTitle('Distance (km)') },
      },
      plugins: {
        legend: { labels: { color: t.ink } },
        ...chartTitle('Pace & distance by week'),
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}${c.dataset.unit}` } },
      },
    },
  });

  return () => chart.destroy();
}
