import { esc, fmtDate } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme, axisTitle, chartTitle } from '../lib/charts.js';
import { verticalBand } from '../lib/chartAnnotations.js';
import { icon } from '../lib/icons.js';

function kindLabel(w) {
  if (w.kind === 'run') return 'Run';
  if (w.kind === 'gym') return `Session ${w.session}`;
  return 'Other';
}

function kindBadge(w) {
  if (w.kind === 'run') return `<span class="badge muted">${icon('footprints')} Run</span>`;
  if (w.kind === 'gym') return `<span class="badge muted">Session ${esc(w.session)}</span>`;
  return `<span class="badge muted">Other</span>`;
}

function summaryLine(w) {
  if (w.kind === 'run') {
    return w.run ? `${w.run.km}km · ${w.run.minutes}min · ${w.run.paceMinPerKm}/km` : '';
  }
  const sets = w.exercises.reduce((n, e) => n + e.summary.workingSets, 0);
  const volume = Math.round(w.exercises.reduce((n, e) => n + e.summary.volumeKg, 0));
  return `${w.exercises.length} exercises · ${sets} sets · ${volume.toLocaleString('en-GB')}kg · ${w.durationMin}min`;
}

function cardHtml(w) {
  return `
    <a class="card" href="#/workouts/${w.id}" data-id="${w.id}" style="text-decoration:none;color:inherit;display:block">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div style="min-width:0">
          <strong>${esc(w.title)}</strong>
          <p class="muted" style="margin:2px 0 0;font-size:.85rem">${fmtDate(w.date)} · S${w.week} · ${esc(summaryLine(w))}</p>
        </div>
        ${kindBadge(w)}
      </div>
      <div class="badge-row" style="display:flex;gap:6px;margin-top:6px">
        ${w.painFlag ? '<span class="badge bad">pain</span>' : ''}
        ${w.warning ? '<span class="badge warn">mismatched week</span>' : ''}
      </div>
    </a>`;
}

export function render(container, ctx) {
  const { data, navigate } = ctx;
  const rows = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));
  const cw = data.cycle.currentWeek;

  const totalVolume = Math.round(data.workouts.reduce((sum, w) =>
    sum + w.exercises.reduce((n, e) => n + e.summary.volumeKg, 0), 0));
  const thisWeek = data.weeks[cw - 1];
  const thisWeekSessions = (thisWeek?.gymDone ?? 0) + (thisWeek?.run ? 1 : 0);
  const latest = rows[0];

  const byWeek = new Map();
  for (const w of rows) {
    if (!byWeek.has(w.week)) byWeek.set(w.week, []);
    byWeek.get(w.week).push(w);
  }

  container.innerHTML = `
    <h1>Workouts</h1>
    <p class="hint">Every logged session, most recent first — gym sessions, runs, and anything
    else Hevy recorded. Tap one for the full breakdown.</p>
    <div class="tiles">
      <div class="tile"><h3>Total workouts</h3><span class="big">${data.workouts.length}</span><p>logged this cycle</p></div>
      <div class="tile"><h3>This week's sessions</h3><span class="big">${thisWeekSessions}/4</span><p>3 gym + the Sunday run</p></div>
      <div class="tile"><h3>Total volume</h3><span class="big">${totalVolume.toLocaleString('en-GB')}kg</span><p>across the cycle</p></div>
      <div class="tile"><h3>Latest session</h3><span class="big">${latest ? kindLabel(latest) : '—'}</span><p>${latest ? fmtDate(latest.date) : 'none logged yet'}</p></div>
    </div>
    <div class="chart-wrap tall"><canvas id="effort-volume"></canvas></div>
    <h2>Logged workouts</h2>
    <div id="rows"></div>
  `;

  const rowsEl = document.createElement('div');
  rowsEl.id = 'rows';
  rowsEl.innerHTML = [...byWeek.entries()].map(([week, list]) => `
    <h3>Week ${week}</h3>
    <div class="cards">${list.map(cardHtml).join('')}</div>
  `).join('');

  document.getElementById('rows').replaceWith(rowsEl);
  rowsEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) { e.preventDefault(); navigate(`#/workouts/${a.dataset.id}`); }
  });

  const t = theme();
  const chart = makeChart(document.getElementById('effort-volume'), {
    type: 'bar',
    data: {
      labels: data.weeks.map((w) => w.week),
      datasets: [
        {
          type: 'bar', label: 'Planned sets', data: data.weeks.map((w) => ({ x: w.week, y: w.week <= cw ? w.plannedSets : null })),
          backgroundColor: t.accent + '99', yAxisID: 'y', unit: ' sets', order: 0, stack: 'sets',
        },
        {
          type: 'bar', label: 'Predicted sets', data: data.weeks.map((w) => ({ x: w.week, y: w.week > cw ? w.plannedSets : null })),
          backgroundColor: t.accent + '40', borderColor: t.accent, borderWidth: 1, borderDash: [6, 4],
          yAxisID: 'y', unit: ' sets', order: 1, stack: 'sets',
        },
        {
          type: 'line', label: 'Planned RPE', data: data.weeks.map((w) => ({ x: w.week, y: w.plannedRpe })),
          borderColor: t.done, backgroundColor: t.done, pointRadius: 3, tension: 0, yAxisID: 'y1', unit: ' RPE', order: 2,
          segment: { borderDash: (c) => (c.p1DataIndex + 1 > cw ? [6, 4] : undefined) },
        },
      ],
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: { ...weekAxis(12, { title: 'Week' }), stacked: true },
        y: { position: 'left', beginAtZero: true, suggestedMax: 100, stacked: true, grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Working sets') },
        y1: { position: 'right', min: 0, max: 10, grid: { drawOnChartArea: false }, ticks: { color: t.muted }, title: axisTitle('RPE (0–10, 10 = failure)') },
      },
      plugins: {
        legend: { labels: { color: t.ink } },
        ...chartTitle('Planned effort & volume by week'),
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}${c.dataset.unit}` } },
      },
    },
    plugins: [verticalBand({ x: cw, fill: t.accentBg, labelColor: t.accent, label: 'you are here' })],
  });

  return () => chart.destroy();
}
