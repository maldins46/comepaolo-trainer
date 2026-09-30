import { weekAxis, chartDefaults, makeChart, theme, axisTitle, chartTitle } from '../lib/charts.js';
import { verticalBand } from '../lib/chartAnnotations.js';
import { fmtDate } from '../lib/format.js';

const TARGET_PACE = 5.2;
const TARGET_KM = 10;

function runRow(r) {
  return `
    <a class="card" href="#/workouts/${r.id}" data-id="${r.id}" style="text-decoration:none;color:inherit;display:block">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div style="min-width:0">
          <strong>S${r.week} run</strong>
          <p class="muted" style="margin:2px 0 0;font-size:.85rem">${fmtDate(r.date)} · ${r.km}km · ${r.minutes}min · ${r.paceMinPerKm}/km</p>
        </div>
      </div>
    </a>`;
}

export function render(container, ctx) {
  const { data, navigate } = ctx;
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
    6-7km during the deload) — shown here together, distance as bars, pace as the line.</p>
    <div class="tiles">
      <div class="tile"><h3>Latest pace</h3><span class="big">${latest ? latest.run.paceMinPerKm.toFixed(2) + '/km' : '—'}</span><p>${latest ? 'S' + latest.week : 'no run logged yet'}</p></div>
      <div class="tile"><h3>Latest distance</h3><span class="big">${latest ? latest.run.km + 'km' : '—'}</span><p>${latest ? 'S' + latest.week : 'no run logged yet'}</p></div>
      <div class="tile"><h3>Pre-break pace</h3><span class="big">${beforeBreakPace.toFixed(2)}/km</span><p>before the cycle</p></div>
      ${block3TargetPace ? `<div class="tile"><h3>Block 3 target</h3><span class="big">${block3TargetPace.toFixed(2)}/km</span><p>weeks 9-11</p></div>` : ''}
    </div>
    <div class="chart-wrap tall"><canvas id="run-chart"></canvas></div>
    ${missing.length ? `<p class="muted">No run logged: ${missing.join(', ')}</p>` : ''}
    <h2>Logged runs</h2>
    <div id="runs"></div>
  `;

  const runsEl = document.createElement('div');
  runsEl.className = 'cards';
  runsEl.id = 'runs';
  const runs = [...data.runs].sort((a, b) => b.date.localeCompare(a.date));
  runsEl.innerHTML = runs.length ? runs.map(runRow).join('') : '<p class="muted">No runs logged yet.</p>';
  document.getElementById('runs').replaceWith(runsEl);
  runsEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) { e.preventDefault(); navigate(`#/workouts/${a.dataset.id}`); }
  });

  const cw = data.cycle.currentWeek;
  const actual = data.weeks.map((w) => ({ x: w.week, y: w.run ? +w.run.paceMinPerKm.toFixed(2) : null }));
  const distance = data.weeks.map((w) => ({ x: w.week, y: w.run?.km ?? null }));

  const latestPace = latest ? +latest.run.paceMinPerKm.toFixed(2) : null;
  const predictedPace = latest && latest.week < maxWeek
    ? Array.from({ length: maxWeek - latest.week + 1 }, (_, i) => {
        const week = latest.week + i;
        const frac = i / (maxWeek - latest.week);
        return { x: week, y: +(latestPace + (TARGET_PACE - latestPace) * frac).toFixed(2) };
      })
    : [];
  const predictedDistance = latest && latest.week < maxWeek
    ? Array.from({ length: maxWeek - latest.week }, (_, i) => ({ x: latest.week + 1 + i, y: TARGET_KM }))
    : [];

  const chart = makeChart(document.getElementById('run-chart'), {
    type: 'bar',
    data: {
      datasets: [
        { type: 'bar', label: 'Distance', data: distance, backgroundColor: t.accent + '99', yAxisID: 'y1', unit: 'km', order: 0, stack: 'distance' },
        { type: 'bar', label: 'Predicted distance', data: predictedDistance, backgroundColor: t.accent + '40', borderColor: t.accent, borderWidth: 1, borderDash: [6, 4], yAxisID: 'y1', unit: 'km', order: 1, stack: 'distance' },
        { type: 'line', label: 'Actual pace', data: actual, borderColor: t.done, backgroundColor: t.done, borderWidth: 3, pointRadius: 4, spanGaps: false, yAxisID: 'y', unit: '/km', order: 2 },
        { type: 'line', label: 'Predicted pace', data: predictedPace, borderColor: t.done, backgroundColor: t.done, borderDash: [6, 4], pointRadius: 4, spanGaps: true, yAxisID: 'y', unit: '/km', order: 3 },
      ],
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: { ...weekAxis(maxWeek, { title: 'Week' }), stacked: true },
        y: { position: 'left', reverse: false, beginAtZero: true, suggestedMax: 9, grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Pace (min/km)') },
        y1: { position: 'right', beginAtZero: true, suggestedMax: 12, stacked: true, grid: { drawOnChartArea: false }, ticks: { color: t.muted }, title: axisTitle('Distance (km)') },
      },
      plugins: {
        legend: { labels: { color: t.ink } },
        ...chartTitle('Pace & distance by week'),
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}${c.dataset.unit}` } },
      },
    },
    plugins: [verticalBand({ x: cw, fill: t.accentBg, labelColor: t.accent, label: 'you are here' })],
  });

  return () => chart.destroy();
}
