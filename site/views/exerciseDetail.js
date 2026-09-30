import { esc, fmtKg, fmtDate, actionColorKey } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme, axisTitle, chartTitle, swatchDot, swatchDash } from '../lib/charts.js';
import { verticalLine, decisionMarker } from '../lib/chartAnnotations.js';
import { twoByTwoProgress, heldForWeeks } from '../lib/progression.js';
import { kindIcon } from '../lib/icons.js';

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
      <div><h1>${esc(meta.name)}</h1><p class="kind-icon" style="margin:0">${kindIcon(meta.kind)} ${esc(meta.kind)}${meta.muscle ? ' · ' + esc(meta.muscle) : ''}${meta.priority ? ' · priority' : ''}${meta.dumbbell ? ' · dumbbell' : ''}</p></div>
    </div>
    ${twoByTwo || held > 0 ? `<p class="muted" style="margin:6px 0 0">${[
      twoByTwo && `Raise rule (2×2): ${twoByTwo.qualifyingWeeks} of ${twoByTwo.required} qualifying weeks`,
      held > 0 && `load unchanged for ${held} ${held === 1 ? 'week' : 'weeks'}`,
    ].filter(Boolean).join(' · ')}</p>` : ''}
    <p class="hint">Coach decisions (ticks above the line) are placed just after the week they were made
    in, since a decision applies to the week that follows it, not the one it's based on.
    ${meta.dumbbell ? ' Dumbbell loads are the sum of both hands since 2026-09-12; earlier sets were logged per hand and are doubled here (marked ×2 in the table and ' + swatchDot(t.warn) + ' on the chart).' : ''}</p>
    <div class="chart-wrap"><canvas id="load-chart"></canvas></div>
    <div class="legend">
      <span>${swatchDot(t.accent)} logged ${assisted ? 'assistance' : 'load'}</span>
      ${meta.dumbbell ? `<span>${swatchDot(t.warn)} doubled (per-hand, pre-2026-09-12)</span>` : ''}
      <span>${swatchDash(t.warn)} block transition</span>
      <span>${swatchDot(t.done)} raised</span>
      <span>${swatchDot(t.bad)} lowered / pain</span>
      <span>${swatchDot(t.warn)} reset / transition</span>
      <span>${swatchDot(t.muted)} held / skipped</span>
    </div>
    <div class="chart-wrap small"><canvas id="e1rm-chart"></canvas></div>
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
      scales: { x: weekAxis(data.cycle.weeks, { title: 'Week' }), y: { reverse: assisted, grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle(assisted ? 'Assistance (kg) — lower is better' : 'Load (kg)') } },
      plugins: { legend: { display: false }, ...chartTitle(assisted ? 'Assistance per session' : 'Top load per session') },
    },
    plugins: [
      verticalLine({ x: 4, color: t.warn, label: 'Block 2' }),
      verticalLine({ x: 9, color: t.warn, label: 'Block 3' }),
      decisionMarker({ points: decisions, colorFor: (action) => t[actionColorKey(action)] }),
    ],
  });

  const e1rm = makeChart(document.getElementById('e1rm-chart'), {
    type: 'line',
    data: { datasets: [{ label: 'e1RM', data: series.map((p) => ({ x: p.week, y: p.bestE1rm })), borderColor: t.done, backgroundColor: t.done, pointRadius: 2, spanGaps: true }] },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(data.cycle.weeks, { title: 'Week' }), y: { grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Estimated 1RM (kg)') } },
      plugins: { legend: { display: false }, ...chartTitle('Estimated one-rep max') },
    },
    plugins: [verticalLine({ x: 4, color: t.warn }), verticalLine({ x: 9, color: t.warn })],
  });

  return () => { load.destroy(); e1rm.destroy(); };
}
