import { esc, fmtKg } from '../lib/format.js';
import { makeChart, theme } from '../lib/charts.js';
import { twoByTwoProgress, heldForWeeks } from '../lib/progression.js';
import { kindIcon } from '../lib/icons.js';

function prescribedTop(p) {
  if (!p.prescribed) return null;
  return p.prescribed.kgPerSet ? Math.max(...p.prescribed.kgPerSet) : p.prescribed.kg ?? null;
}

function sparkline(canvas, series, assisted, accent, muted) {
  // x = position within the window, not the week number: some exercises run twice in the
  // same week (sessions A and C), which would otherwise collide on one x and draw as a
  // near-vertical stroke instead of a trend. The tooltip still looks up the real week per point.
  const points = series.slice(-8);
  const weeks = points.map((p) => p.week);
  const actual = points.map((p, i) => ({ x: i, y: p.topKg }));
  const prescribed = points.map((p, i) => ({ x: i, y: prescribedTop(p) }));
  return makeChart(canvas, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Target', data: prescribed, borderColor: muted, borderDash: [3, 3], borderWidth: 1, pointRadius: 0, spanGaps: true },
        { label: 'Actual', data: actual, borderColor: accent, backgroundColor: accent, pointRadius: 0, borderWidth: 2, tension: 0.25 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      scales: {
        x: { type: 'linear', display: false },
        y: { display: true, reverse: assisted, ticks: { display: false }, border: { display: false }, grid: { color: muted + '33' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          filter: (item) => item.parsed.y != null,
          callbacks: {
            title: (items) => 'S' + weeks[items[0].dataIndex],
            label: (item) => `${item.dataset.label}: ${item.parsed.y}kg`,
          },
        },
      },
    },
  });
}

export function render(container, ctx) {
  const { data, navigate } = ctx;
  const t = theme();
  const keys = Object.keys(data.exercises).filter((k) => data.series[k]?.length);
  keys.sort((a, b) => (data.exercises[b].priority ? 1 : 0) - (data.exercises[a].priority ? 1 : 0));

  container.innerHTML = `<h1>Exercises</h1>
    <p class="hint">Priority exercises — shoulders and chest — come first. The sparkline is the last 8
    top-set loads; "2×2" shows progress toward the coach's raise rule (two qualifying sessions in a row
    at the top of the rep range), and "held Nw" counts weeks since the load last went up. Both show
    nothing when there's no coach decision yet for that exercise, rather than guessing.</p>
    <div class="cards" id="cards"></div>`;
  const cardsEl = document.getElementById('cards');
  const charts = [];

  cardsEl.innerHTML = keys.map((key) => {
    const meta = data.exercises[key];
    const series = data.series[key];
    const assisted = meta.kind === 'assisted';
    const last = series.at(-1);
    const twoByTwo = twoByTwoProgress(series);
    const held = heldForWeeks(series);
    return `<a class="card" href="#/exercises/${key}" style="text-decoration:none;color:inherit;display:block" data-key="${key}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div style="min-width:0">
          <strong>${esc(meta.name)}</strong>
          <p class="kind-icon" style="margin:2px 0 0">${kindIcon(meta.kind)} ${esc(meta.kind)}</p>
          <p class="muted" style="margin:2px 0 0;font-size:.85rem">${assisted ? 'Assistance ' + fmtKg(last?.topKg) + ' (lower is better)' : fmtKg(last?.topKg)}</p>
        </div>
        ${meta.priority ? '<span class="badge done">priority</span>' : ''}
      </div>
      <div class="chart-wrap small"><canvas data-spark="${key}"></canvas></div>
      <div class="badge-row" style="display:flex;gap:6px">
        ${twoByTwo ? `<span class="badge warn">2×2: ${twoByTwo.qualifyingWeeks}/${twoByTwo.required}</span>` : ''}
        ${held > 0 ? `<span class="badge muted">held ${held}w</span>` : ''}
      </div>
    </a>`;
  }).join('');

  for (const key of keys) {
    const canvas = cardsEl.querySelector(`canvas[data-spark="${key}"]`);
    if (canvas) charts.push(sparkline(canvas, data.series[key], data.exercises[key].kind === 'assisted', t.accent, t.muted));
  }

  cardsEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-key]');
    if (a) { e.preventDefault(); navigate(`#/exercises/${a.dataset.key}`); }
  });

  return () => charts.forEach((c) => c.destroy());
}
