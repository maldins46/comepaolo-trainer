import { esc, fractionalWeek } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme } from '../lib/charts.js';

export function render(container, ctx) {
  const { data } = ctx;
  const bw = data.bodyweight;
  const maxWeek = data.cycle.weeks;
  const base = bw.weeks.find((w) => w.avg != null);
  const { targetKgPerWeek, minKgPerWeek, maxKgPerWeek } = data.rules.weightLoss;
  const t = theme();

  const missing = bw.weeks.filter((w) => w.avg == null && data.weeks[w.week - 1]?.state !== 'future').map((w) => 'S' + w.week);
  const suggestion = [...data.weeks].reverse().find((w) => w.coach?.nutrition?.suggestion)?.coach.nutrition;
  const suggestionWeek = [...data.weeks].reverse().find((w) => w.coach?.nutrition?.suggestion)?.week;

  container.innerHTML = `
    <h1>Weight</h1>
    <p class="muted">Weekly average vs a ${targetKgPerWeek}kg/week target (${minKgPerWeek}–${maxKgPerWeek} healthy band), anchored at the first week with enough data.</p>
    <div class="chart-wrap tall"><canvas id="weight-chart"></canvas></div>
    ${missing.length ? `<p class="muted">Not enough data: ${missing.join(', ')}</p>` : ''}
    ${suggestion ? `<div class="banner info"><strong>Coach nutrition note (week ${suggestionWeek}):</strong> ${esc(suggestion.suggestion)}</div>` : ''}
  `;

  if (!base) {
    container.querySelector('.chart-wrap').innerHTML = '<p class="muted">Not enough bodyweight data yet.</p>';
    return;
  }

  const target = (w) => base.avg - targetKgPerWeek * (w - base.week);
  const slow = (w) => base.avg - minKgPerWeek * (w - base.week);
  const fast = (w) => base.avg - maxKgPerWeek * (w - base.week);
  const weeksInRange = Array.from({ length: maxWeek }, (_, i) => i + 1).filter((w) => w >= base.week);

  const avgPoints = bw.weeks.map((w) => ({ x: w.week, y: w.avg }));
  const dayPoints = bw.days.map((d) => ({ x: fractionalWeek(d.date, data.cycle.start), y: d.kg }));

  const chart = makeChart(document.getElementById('weight-chart'), {
    type: 'line',
    data: {
      datasets: [
        { label: 'Fast bound', data: weeksInRange.map((w) => ({ x: w, y: fast(w) })), borderWidth: 0, pointRadius: 0, fill: false },
        { label: 'Healthy band', data: weeksInRange.map((w) => ({ x: w, y: slow(w) })), borderWidth: 0, pointRadius: 0, backgroundColor: t.doneBg, fill: '-1' },
        { label: `Target (−${targetKgPerWeek}kg/wk)`, data: weeksInRange.map((w) => ({ x: w, y: target(w) })), borderColor: t.muted, borderDash: [5, 4], pointRadius: 0, fill: false },
        { label: 'Daily', data: dayPoints, showLine: false, pointRadius: 2, pointBackgroundColor: t.muted + '66', pointBorderWidth: 0 },
        { label: 'Weekly average', data: avgPoints, borderColor: t.accent, backgroundColor: t.accent, pointRadius: 4, spanGaps: false },
      ],
    },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(maxWeek), y: { grid: { color: t.line }, ticks: { color: t.muted } } },
      plugins: { legend: { labels: { color: t.ink, filter: (item) => item.text !== 'Fast bound' } } },
    },
  });

  return () => chart.destroy();
}
