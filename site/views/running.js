import { weekAxis, chartDefaults, makeChart, theme } from '../lib/charts.js';

export function render(container, ctx) {
  const { data } = ctx;
  const maxWeek = data.cycle.weeks;
  const { beforeBreakMinutes, onReturnMinutes } = data.runningBaseline;
  const t = theme();

  const missing = data.weeks
    .filter((w) => w.state !== 'future' && !w.run)
    .map((w) => 'S' + w.week);

  container.innerHTML = `
    <h1>Running</h1>
    <p class="muted">10km-equivalent time per week (pace × 10, so weeks that aren't literally 10km still plot on one line — an approximation) vs the return baseline (${onReturnMinutes}'), the block 3 goal, and the pre-break baseline (${beforeBreakMinutes}').</p>
    <div class="chart-wrap tall"><canvas id="run-chart"></canvas></div>
    ${missing.length ? `<p class="muted">No run logged: ${missing.join(', ')}</p>` : ''}
  `;

  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const actual = data.weeks.map((w) => ({ x: w.week, y: w.run ? +(w.run.paceMinPerKm * 10).toFixed(1) : null }));
  const onReturn = weeks.map((w) => ({ x: w, y: onReturnMinutes }));
  const beforeBreak = weeks.map((w) => ({ x: w, y: beforeBreakMinutes }));
  const block3Target = data.weeks.map((w) => ({ x: w.week, y: w.runTargetMinutes ?? null }));

  const chart = makeChart(document.getElementById('run-chart'), {
    type: 'line',
    data: {
      datasets: [
        { label: 'Actual (10km-eq.)', data: actual, borderColor: t.accent, backgroundColor: t.accent, pointRadius: 4, spanGaps: false },
        { label: 'Return baseline', data: onReturn, borderColor: t.muted, borderDash: [5, 4], pointRadius: 0 },
        { label: 'Pre-break baseline', data: beforeBreak, borderColor: t.muted, borderDash: [2, 3], pointRadius: 0 },
        { label: 'Block 3 goal', data: block3Target, borderColor: t.done, pointRadius: 3, spanGaps: false },
      ],
    },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(maxWeek), y: { reverse: false, grid: { color: t.line }, ticks: { color: t.muted } } },
      plugins: { legend: { labels: { color: t.ink } } },
    },
  });

  return () => chart.destroy();
}
