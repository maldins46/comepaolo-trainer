import { esc, fmtKg, fmtDate, actionColorKey } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme } from '../lib/charts.js';
import { verticalLine, decisionMarker } from '../lib/chartAnnotations.js';
import { twoByTwoProgress, heldForWeeks } from '../lib/progression.js';

function actualSetKgs(workoutsById, key, workoutId) {
  const w = workoutsById.get(workoutId);
  const ex = w?.exercises.find((e) => e.key === key);
  return ex?.sets.filter((s) => s.type !== 'warmup').map((s) => s.kg) ?? [];
}

function renderRows(series, key, exercises, workoutsById) {
  return series.map((p) => {
    const prescribedKg = p.prescribed?.kgPerSet ? p.prescribed.kgPerSet.map(fmtKg).join('/') : fmtKg(p.prescribed?.kg ?? null);
    const actualKg = actualSetKgs(workoutsById, key, p.workoutId).map(fmtKg).join('/');
    return `<tr>
      <td>${fmtDate(p.date)}</td><td>${esc(p.session)}</td>
      <td class="num">${prescribedKg}</td>
      <td class="num">${actualKg}${p.doubled ? ' <span class="badge muted" title="Logged per hand before 2026-09-12, doubled">×2</span>' : ''}</td>
      <td class="num">${p.reps.join('/')}</td>
      <td class="num">${p.bestE1rm ?? '—'}</td>
      <td>${p.progression?.reason ? esc(p.progression.reason) : ''}</td>
    </tr>`;
  }).reverse().join('');
}

export function render(container, ctx, params) {
  const { data, workoutsById } = ctx;
  const key = params.key;
  const meta = data.exercises[key];
  const series = data.series[key] ?? [];
  const t = theme();

  if (!meta || !series.length) {
    container.innerHTML = `<p><a href="#/exercises">← Exercises</a></p><p class="muted">No data for this exercise.</p>`;
    return;
  }

  const assisted = meta.kind === 'assisted';
  const twoByTwo = twoByTwoProgress(series);
  const held = heldForWeeks(series);
  const decisions = data.weeks.flatMap((w) => (w.coach?.decisions ?? []).filter((d) => d.ex === key).map((d) => ({ ...d, week: w.week })));

  container.innerHTML = `
    <p><a href="#/exercises">← Exercises</a></p>
    <div class="topbar">
      <div><h1>${esc(meta.name)}</h1><p class="muted" style="margin:0">${esc(meta.kind)}${meta.priority ? ' · priority' : ''}${meta.dumbbell ? ' · dumbbell' : ''}</p></div>
      <div class="badge-row" style="display:flex;gap:6px">
        ${twoByTwo ? `<span class="badge warn">2×2: ${twoByTwo.qualifyingWeeks}/${twoByTwo.required}</span>` : ''}
        ${held > 0 ? `<span class="badge muted">held ${held}w</span>` : ''}
      </div>
    </div>
    ${assisted ? '<p class="muted">Assistance load — lower is better. Chart axis is inverted.</p>' : ''}
    ${meta.dumbbell ? `<p class="muted">Dumbbell loads are the sum of both hands since 2026-09-12; earlier sets were per hand and are doubled (marked ×2 below).</p>` : ''}
    <div class="chart-wrap"><canvas id="load-chart"></canvas></div>
    <div class="chart-wrap small"><canvas id="e1rm-chart"></canvas></div>
    <p class="muted">Dashed vertical lines mark block transitions (weeks 4, 9) — loads jump 10–15% there because the rep range drops; that jump is not progress. Ticks above the chart mark coach decisions, made at the end of a week and applied after it.</p>
    <h2>Sessions</h2>
    <table class="tbl">
      <thead><tr><th>Date</th><th>Session</th><th class="num">Prescribed</th><th class="num">Actual</th><th class="num">Reps</th><th class="num">e1RM</th><th>Coach reason</th></tr></thead>
      <tbody>${renderRows(series, key, data.exercises, workoutsById)}</tbody>
    </table>
  `;

  const points = series.map((p) => ({ x: p.week, y: p.topKg, doubled: p.doubled }));
  const load = makeChart(document.getElementById('load-chart'), {
    type: 'line',
    data: {
      datasets: [{
        label: assisted ? 'Assistance (kg)' : 'Top load (kg)',
        data: points,
        borderColor: t.accent, backgroundColor: t.accent,
        pointBackgroundColor: points.map((p) => (p.doubled ? t.warn : t.accent)),
        pointRadius: points.map((p) => (p.doubled ? 5 : 3)),
        spanGaps: true,
      }],
    },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(data.cycle.weeks), y: { reverse: assisted, grid: { color: t.line }, ticks: { color: t.muted } } },
      plugins: { legend: { display: false } },
    },
    plugins: [
      verticalLine({ x: 4, color: t.warn }),
      verticalLine({ x: 9, color: t.warn }),
      decisionMarker({ points: decisions, colorFor: (action) => t[actionColorKey(action)] }),
    ],
  });

  const e1rm = makeChart(document.getElementById('e1rm-chart'), {
    type: 'line',
    data: { datasets: [{ label: 'e1RM', data: series.map((p) => ({ x: p.week, y: p.bestE1rm })), borderColor: t.done, backgroundColor: t.done, pointRadius: 2, spanGaps: true }] },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(data.cycle.weeks), y: { grid: { color: t.line }, ticks: { color: t.muted } } },
      plugins: { legend: { display: false } },
    },
    plugins: [verticalLine({ x: 4, color: t.warn }), verticalLine({ x: 9, color: t.warn })],
  });

  return () => { load.destroy(); e1rm.destroy(); };
}
