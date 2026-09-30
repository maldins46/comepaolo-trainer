import { esc, fmtKg } from '../lib/format.js';
import { chartDefaults, makeChart, theme, axisTitle, chartTitle } from '../lib/charts.js';
import { kindIcon, icon } from '../lib/icons.js';
import { weightTrend } from '../lib/progression.js';

const TREND_ICON = { up: 'trendingUp', down: 'trendingDown', same: 'minus' };

function trendHtml(series, assisted) {
  const tr = weightTrend(series);
  if (!tr) return '';
  // For assisted exercises less assistance is progress, so the colour flips while the arrow still follows the kg.
  const better = assisted ? tr.dir === 'down' : tr.dir === 'up';
  const tone = tr.dir === 'same' ? 'same' : better ? 'good' : 'watch';
  const label = tr.dir === 'same' ? 'same as' : `${tr.delta > 0 ? '+' : '−'}${Math.abs(tr.delta)}kg vs`;
  return `<span class="trend ${tone}" title="Top load in S${tr.lastWeek} vs S${tr.prevWeek}">${icon(TREND_ICON[tr.dir])} ${label} S${tr.prevWeek}</span>`;
}

function exerciseCard(key, meta, series) {
  const assisted = meta.kind === 'assisted';
  const last = series.at(-1);
  return `<a class="card" href="#/exercises/${key}" style="text-decoration:none;color:inherit;display:block" data-key="${key}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
      <div style="min-width:0">
        <strong>${esc(meta.name)}</strong>
        <p class="kind-icon" style="margin:2px 0 0">${kindIcon(meta.kind)} ${esc(meta.kind)}</p>
        <p class="muted" style="margin:2px 0 0;font-size:.85rem">${assisted ? 'Assistance ' + fmtKg(last?.topKg) + ' (lower is better)' : fmtKg(last?.topKg)}</p>
      </div>
      ${meta.priority ? '<span class="badge done">priority</span>' : ''}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px">
      <span>${trendHtml(series, assisted)}</span>
      <span class="badge muted" title="Logged in ${series.length} ${series.length === 1 ? 'session' : 'sessions'}">${series.length} ${series.length === 1 ? 'session' : 'sessions'}</span>
    </div>
  </a>`;
}

function muscleChart(canvas, data, t) {
  const weeks = data.weeks.filter((w) => w.week <= data.cycle.currentWeek);
  const sum = (kind, m) => weeks.reduce((n, w) => n + (w.setsByMuscle?.[kind]?.[m] ?? 0), 0);
  const groups = data.muscleGroups;
  const logged = groups.map((m) => sum('logged', m));
  const planned = groups.map((m) => sum('planned', m));
  const remaining = groups.map((m, i) => Math.max(planned[i] - logged[i], 0));
  return makeChart(canvas, {
    type: 'bar',
    data: {
      labels: groups,
      datasets: [
        { label: 'Logged', data: logged, backgroundColor: t.accent + '99' },
        { label: 'Still to do', data: remaining, backgroundColor: t.accent + '40', borderColor: t.accent, borderWidth: 1, borderDash: [6, 4] },
      ],
    },
    options: {
      ...chartDefaults(),
      indexAxis: 'y',
      scales: {
        x: { stacked: true, beginAtZero: true, grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Working sets') },
        y: { stacked: true, grid: { display: false }, ticks: { color: t.ink } },
      },
      plugins: {
        legend: { labels: { color: t.ink } },
        ...chartTitle('Working sets so far vs plan'),
        tooltip: {
          callbacks: {
            label: (c) => (c.datasetIndex === 0
              ? `Logged: ${logged[c.dataIndex]} of ${planned[c.dataIndex]} planned sets`
              : `Still to do: ${remaining[c.dataIndex]} sets`),
          },
        },
      },
    },
  });
}

export function render(container, ctx) {
  const { data, navigate } = ctx;
  const t = theme();

  const groups = data.muscleGroups
    .map((muscle) => ({
      muscle,
      keys: Object.keys(data.exercises)
        .filter((k) => data.exercises[k].muscle === muscle && data.series[k]?.length)
        .sort((a, b) => (data.exercises[b].priority ? 1 : 0) - (data.exercises[a].priority ? 1 : 0)),
    }))
    .filter((g) => g.keys.length);

  container.innerHTML = `<h1>Exercises</h1>
    <p class="hint">Every exercise you've logged, grouped by muscle. Shoulders and chest are the priority
    muscles, so they come first, and priority exercises lead each group. Tap one for its load history
    and the coach's decisions.</p>
    <div class="chart-wrap tall"><canvas id="muscle-chart"></canvas></div>
    <p class="hint">Sets count every session planned up to the current week, so a muscle reads behind
    until the week is finished.</p>
    <div id="groups">${groups.map((g) => `
      <h2>${esc(g.muscle)}</h2>
      <div class="cards">${g.keys.map((k) => exerciseCard(k, data.exercises[k], data.series[k])).join('')}</div>`).join('')}
    </div>`;

  const chart = muscleChart(document.getElementById('muscle-chart'), data, t);

  document.getElementById('groups').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-key]');
    if (a) { e.preventDefault(); navigate(`#/exercises/${a.dataset.key}`); }
  });

  return () => chart.destroy();
}
