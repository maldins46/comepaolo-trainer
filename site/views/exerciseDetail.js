import { esc, fmtKg, fmtDate, fractionalWeek } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme, axisTitle, chartTitle, swatchDot, swatchDash } from '../lib/charts.js';
import { verticalLine } from '../lib/chartAnnotations.js';
import { twoByTwoProgress, heldForWeeks, projectLoads } from '../lib/progression.js';
import { exerciseInWeek, plannedReps } from '../lib/plan.js';
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
    container.innerHTML = `<p class="muted">No data for this exercise.</p>`;
    return;
  }

  const assisted = meta.kind === 'assisted';
  const twoByTwo = twoByTwoProgress(series);
  const held = heldForWeeks(series);

  // Estimate of the load in the weeks still to come, only for weeks where the exercise is in the
  // program. The first point is the coach's own prescription when their latest file has one.
  const last = series.at(-1);
  const coachWeek = [...data.weeks].reverse().find((w) => w.coach?.next);
  const coachKgs = coachWeek && coachWeek.week === last.week
    ? ['A', 'B', 'C'].flatMap((x) => (coachWeek.coach.next[x] ?? []).filter((r) => r.ex === key)).map((r) => (r.kgPerSet ? Math.max(...r.kgPerSet) : r.kg)).filter((v) => v != null)
    : [];
  const projected = projectLoads({
    series, maxWeek: data.cycle.weeks, assisted,
    nextWeekKg: coachKgs.length ? Math.max(...coachKgs) : null,
    inProgram: (w) => exerciseInWeek(data, w, key),
    fromWeek: data.cycle.currentWeek,
  });

  // points sit at their date inside the week, so the last week needs room to the right of its tick
  const xAxis = { ...weekAxis(data.cycle.weeks, { title: 'Week' }), max: data.cycle.weeks + 1 };
  const xOf = (p) => fractionalWeek(p.date, data.cycle.start);
  const points = series.map((p) => ({ x: xOf(p), y: p.topKg, doubled: p.doubled, date: p.date }));
  const tipTitle = (items) => (items[0].raw.date ? fmtDate(items[0].raw.date) : items[0].dataset.label);

  // Estimate line: starts at the last logged point, one point mid-week per projected week, broken
  // across weeks where the exercise isn't in the program.
  const estimateLine = (startY, items) => {
    const out = startY != null ? [{ x: xOf(last), y: startY }] : [];
    let prevWeek = last.week;
    for (const p of items) {
      if (p.y == null) continue;
      if (p.week !== prevWeek + 1) out.push({ x: p.week - 0.5, y: null });
      out.push({ x: p.week + 3 / 7, y: p.y });
      prevWeek = p.week;
    }
    return out;
  };
  const estimate = estimateLine(last.topKg, projected.map((p) => ({ week: p.week, y: p.kg })));
  // Same Epley formula the logged e1RM uses, applied to the estimated load at that week's target reps.
  const e1rmEstimate = estimateLine(last.bestE1rm, projected.map((p) => {
    const reps = plannedReps(data, p.week, key);
    return { week: p.week, y: reps == null ? null : +(p.kg * (1 + reps / 30)).toFixed(1) };
  }));

  container.innerHTML = `
    <div class="topbar">
      <div><h1>${esc(meta.name)}</h1><p class="kind-icon" style="margin:0">${kindIcon(meta.kind)} ${esc(meta.kind)}${meta.muscle ? ' · ' + esc(meta.muscle) : ''}${meta.priority ? ' · priority' : ''}${meta.dumbbell ? ' · dumbbell' : ''}</p></div>
    </div>
    ${twoByTwo || held > 0 ? `<p class="muted" style="margin:6px 0 0">${[
      twoByTwo && `Raise rule (2×2): ${twoByTwo.qualifyingWeeks} of ${twoByTwo.required} qualifying weeks`,
      held > 0 && `load unchanged for ${held} ${held === 1 ? 'week' : 'weeks'}`,
    ].filter(Boolean).join(' · ')}</p>` : ''}
    <div class="chart-wrap"><canvas id="load-chart"></canvas></div>
    <div class="legend">
      <span>${swatchDot(t.accent)} logged ${assisted ? 'assistance' : 'load'}</span>
      ${meta.dumbbell ? `<span>${swatchDot(t.warn)} doubled (per-hand, pre-2026-09-12)</span>` : ''}
      ${projected.length ? `<span>${swatchDash(t.accent)} estimate</span>` : ''}
      <span>${swatchDash(t.warn)} block transition</span>
    </div>
    <p class="hint">${assisted ? 'The least help you needed in each session (assistance, so lower is better)' : 'The heaviest load you used in each session'}, placed on the day it was logged.
    The vertical dashed lines mark the block changes (S4, S9): loads jump there because the rep range drops.
    ${projected.length ? `The dashed estimate line covers the weeks ahead where this exercise is in the program. It is not a prescription: it
    continues your own weekly gain, adds about 12.5% at block changes, repeats week 7's load in the deload and drops 10% in the taper,
    starting from the coach's prescription when there is one.` : ''}
    ${meta.dumbbell ? `Dumbbell loads are the sum of both hands since 2026-09-12; earlier sets were logged per hand and are doubled here (marked ×2 in the table and ${swatchDot(t.warn)} on the chart).` : ''}</p>
    <div class="chart-wrap"><canvas id="e1rm-chart"></canvas></div>
    <p class="hint">Estimated one-rep max: the heaviest weight you could lift once, worked out from your best set of each
    session as load × (1 + reps ÷ 30) (the Epley formula). It rises when you get stronger even if the load stays the same,
    so it shows progress that the load chart alone hides.
    ${e1rmEstimate.length > 1 ? `The dashed line applies the same formula to the estimated loads at each week's target reps, so it assumes you hit them.` : ''}</p>
    <h2>Sessions</h2>
    <table class="tbl">
      <thead><tr><th>Date</th><th>Session</th><th class="num">Prescribed</th><th class="num">Actual</th><th class="num">Reps</th><th class="num">e1RM</th><th>Coach reason</th></tr></thead>
      <tbody>${renderRows(series, key, data.exercises, workoutsById)}</tbody>
    </table>
  `;

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
      }, ...(projected.length ? [{
        label: 'Estimate (kg)',
        data: estimate,
        borderColor: t.accent, borderDash: [6, 4], borderWidth: 2, spanGaps: false,
        pointRadius: estimate.map((p, i) => (i === 0 && p.x === xOf(last) ? 0 : 4)), pointStyle: 'rectRot',
        pointBackgroundColor: 'transparent', pointBorderColor: t.accent, pointBorderWidth: 2,
      }] : [])],
    },
    options: {
      ...chartDefaults(),
      scales: { x: xAxis, y: { reverse: assisted, grace: '22%', grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle(assisted ? 'Assistance (kg) — lower is better' : 'Load (kg)') } },
      plugins: { legend: { display: false }, ...chartTitle(assisted ? 'Assistance per session' : 'Top load per session'), tooltip: { callbacks: { title: tipTitle } } },
    },
    plugins: [
      verticalLine({ x: 4, color: t.warn, label: 'Block 2' }),
      verticalLine({ x: 9, color: t.warn, label: 'Block 3' }),
    ],
  });

  const e1rm = makeChart(document.getElementById('e1rm-chart'), {
    type: 'line',
    data: {
      datasets: [{ label: 'e1RM', data: series.map((p) => ({ x: xOf(p), y: p.bestE1rm, date: p.date })), borderColor: t.done, backgroundColor: t.done, pointRadius: 2, spanGaps: true },
        ...(e1rmEstimate.length > 1 ? [{
          label: 'e1RM estimate (kg)', data: e1rmEstimate,
          borderColor: t.done, borderDash: [6, 4], borderWidth: 2, spanGaps: false,
          pointRadius: e1rmEstimate.map((p, i) => (i === 0 && p.x === xOf(last) ? 0 : 4)), pointStyle: 'rectRot',
          pointBackgroundColor: 'transparent', pointBorderColor: t.done, pointBorderWidth: 2,
        }] : [])],
    },
    options: {
      ...chartDefaults(),
      scales: { x: xAxis, y: { grace: '22%', grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Estimated 1RM (kg)') } },
      plugins: { legend: { display: false }, ...chartTitle('Estimated one-rep max'), tooltip: { callbacks: { title: tipTitle } } },
    },
    plugins: [verticalLine({ x: 4, color: t.warn }), verticalLine({ x: 9, color: t.warn })],
  });

  return () => { load.destroy(); e1rm.destroy(); };
}
