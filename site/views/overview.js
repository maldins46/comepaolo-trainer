import { esc, fmtKg } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme } from '../lib/charts.js';
import { verticalBand } from '../lib/chartAnnotations.js';

function nextAction(week, cycle) {
  const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(cycle.today + 'T00:00:00Z').getUTCDay()];
  if (!week.run && dow === cycle.runDay) return { type: 'run' };
  const session = ['A', 'B', 'C'].find((s) => !week.sessions[s]);
  return session ? { type: 'session', session } : { type: 'done' };
}

function renderPrescriptionRows(rows, exercises) {
  if (!rows?.length) return '<p class="muted">No prescription rows.</p>';
  return `<table class="tbl"><thead><tr><th>Exercise</th><th class="num">Sets×Reps</th><th class="num">Load</th></tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td>${esc(exercises[r.ex]?.name ?? r.ex)}</td>
      <td class="num">${r.sets}×${r.reps ?? r.seconds + 's'}${r.repsMax ? '-' + r.repsMax : ''}</td>
      <td class="num">${r.kgPerSet ? r.kgPerSet.map(fmtKg).join('/') : fmtKg(r.kg)}</td>
    </tr>`).join('')}
  </tbody></table>`;
}

function renderWhatsNext(data) {
  const cw = data.cycle.currentWeek;
  const week = data.weeks[cw - 1];
  if (!week) return '';
  const prev = data.weeks[cw - 2];
  const action = nextAction(week, data.cycle);

  if (action.type === 'done') {
    return `<div class="card"><h3>What's next</h3><p class="muted">All sessions logged for this week. Nice.</p></div>`;
  }
  if (action.type === 'run') {
    return `<div class="card"><h3>What's next</h3><p>Sunday run — target: ${esc(week.runTarget ?? '—')}</p></div>`;
  }

  const prescription = week.coach?.prescription ?? prev?.coach?.next ?? null;
  const rows = prescription?.[action.session];
  if (rows) {
    return `<div class="card"><h3>What's next: session ${action.session}</h3>${renderPrescriptionRows(rows, data.exercises)}</div>`;
  }
  if (week.planned?.rule) {
    return `<div class="card"><h3>What's next: session ${action.session}</h3><p>${esc(week.planned.rule)}</p>
      <p class="muted"><a href="#/week/${week.week}">Full week ${week.week} plan →</a></p></div>`;
  }
  const base = week.planned?.[action.session];
  return `<div class="card"><h3>What's next: session ${action.session}</h3>
    <p class="muted">No coach-assigned load yet — base plan shown.</p>
    ${renderPrescriptionRows(base?.map((r) => ({ ex: r.ex, sets: r.scheme.sets ?? '?', reps: r.scheme.reps, seconds: r.scheme.seconds, repsMax: r.scheme.repsMax })) ?? [], data.exercises)}</div>`;
}

function weekBadgeClass(w) {
  if (/deload/i.test(w.phase) || w.week === 8) return 'deload';
  if (/taper/i.test(w.phase) || w.week === 12) return 'taper';
  return '';
}

function renderStrip(data, navigate) {
  const rows = data.weeks.map((w) => {
    const pain = w.painFlag || w.coach?.painFlags?.length;
    return `<div class="wk ${w.state} ${weekBadgeClass(w)}" data-week="${w.week}" title="${esc(w.phase)}">
      <b>S${w.week}</b>
      <span class="dots">${['A', 'B', 'C'].map((s) => (w.sessions[s] ? '●' : '○')).join('')}${w.run ? '▲' : '△'}</span><br>
      <span class="muted">${w.bodyweight?.avg ? w.bodyweight.avg.toFixed(1) + 'kg' : '—'}</span>
      <div class="badge-row">
        ${weekBadgeClass(w) ? `<span class="badge warn">${weekBadgeClass(w)}</span>` : ''}
        ${pain ? '<span class="badge bad">pain</span>' : ''}
      </div>
    </div>`;
  }).join('');
  const el = document.createElement('div');
  el.className = 'weeks';
  el.innerHTML = rows;
  el.addEventListener('click', (e) => {
    const cell = e.target.closest('.wk');
    if (cell) navigate(`#/week/${cell.dataset.week}`);
  });
  return el;
}

export function render(container, ctx) {
  const { data, navigate } = ctx;
  const charts = [];
  const latestCoachWeek = [...data.weeks].reverse().find((w) => w.coach);

  container.innerHTML = `
    ${data.weeks.some((w) => w.coach?.halt?.halted) ? `<div class="banner bad">Halted: ${esc(data.weeks.find((w) => w.coach?.halt?.halted).coach.halt.reasons.join('; '))}</div>` : ''}
    ${latestCoachWeek ? `<div class="banner info"><strong>Latest verdict (week ${latestCoachWeek.week}):</strong> ${esc(latestCoachWeek.coach.verdict ?? '—')}</div>` : ''}
    ${renderWhatsNext(data)}
    <h2>12-week strip</h2>
    <div id="strip"></div>
    <p class="muted">Week 8 is a deload and week 12 is a taper — both look lighter by design, not a drop in performance.</p>
    <h2>Effort &amp; volume</h2>
    <div class="chart-wrap"><canvas id="effort"></canvas></div>
    <div class="chart-wrap small"><canvas id="volume"></canvas></div>
    <p class="muted">Effort = planned RPE (10 − RIR midpoint). Volume = planned working sets across A+B+C. Both derived from the plan, not from what was actually lifted.</p>
  `;

  document.getElementById('strip').replaceWith(renderStrip(data, navigate));

  const cw = data.cycle.currentWeek;
  const weeks = data.weeks.map((w) => w.week);
  const t = theme();

  const effort = makeChart(document.getElementById('effort'), {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Planned RPE',
        data: data.weeks.map((w) => ({ x: w.week, y: w.plannedRpe })),
        borderColor: t.accent, backgroundColor: t.accent, pointRadius: 3, tension: 0,
        segment: { borderDash: (c) => (c.p1DataIndex + 1 > cw ? [6, 4] : undefined) },
      }],
    },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(12), y: { min: 0, max: 10, grid: { color: t.line }, ticks: { color: t.muted } } },
      plugins: { legend: { display: false } },
    },
    plugins: [verticalBand({ x: cw, fill: t.accentBg, labelColor: t.accent, label: 'you are here' })],
  });

  const volume = makeChart(document.getElementById('volume'), {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: [{ label: 'Planned sets', data: data.weeks.map((w) => ({ x: w.week, y: w.plannedSets })), backgroundColor: t.accent + '99' }],
    },
    options: {
      ...chartDefaults(),
      scales: { x: weekAxis(12), y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
    plugins: [verticalBand({ x: cw, fill: t.accentBg, labelColor: t.accent })],
  });

  charts.push(effort, volume);
  return () => charts.forEach((c) => c.destroy());
}
