import { esc, fmtKg } from '../lib/format.js';
import { weekAxis, chartDefaults, makeChart, theme, axisTitle, chartTitle } from '../lib/charts.js';
import { verticalBand } from '../lib/chartAnnotations.js';
import { icon } from '../lib/icons.js';

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

const STATUS_TILE_CLASS = { ok: 'status-ok', slow: 'status-low', fast: 'status-high', halt: 'status-high' };

function renderHero(data) {
  const cw = data.cycle.currentWeek;
  const week = data.weeks[cw - 1];
  const bw = week?.bodyweight;
  const action = week ? nextAction(week, data.cycle) : null;
  const nextLabel = !action ? '—'
    : action.type === 'run' ? 'Run'
    : action.type === 'done' ? 'Done'
    : `Session ${action.session}`;
  const nextSub = !action ? ''
    : action.type === 'run' ? (week.runTarget ?? 'Sunday run')
    : action.type === 'done' ? 'nothing left this week'
    : (week.coach?.prescription?.[action.session] ?? data.weeks[cw - 2]?.coach?.next?.[action.session]) ? 'load assigned'
    : 'base plan (no load yet)';

  const alertText = week?.coach?.halt?.halted
    ? `Halted: ${week.coach.halt.reasons.join('; ')}`
    : (week?.painFlag || week?.coach?.painFlags?.length) ? 'Pain flagged this week — see details below.' : null;

  return `
    <p class="hint">Comepaolo Training tracks a 12-week body-recomposition cycle coached by Claude every
    Saturday, who reads Hevy, decides next week's loads and sends a report. This page shows where the
    week stands right now; the tabs above dig into weight, exercises, running and the coach's decisions.</p>
    <p class="muted" style="margin:0">Updated ${new Date(data.generatedAt).toLocaleString('en-GB')}</p>
    <div class="tiles">
      <div class="tile"><h3>Phase</h3><span class="big">Week ${cw} of 12</span><p>${esc(week?.phase ?? '—')}</p></div>
      <div class="tile"><h3>This week</h3><span class="big">${week?.gymDone ?? 0}/3</span><p>${week?.run ? 'run logged' : 'run pending'}</p></div>
      <div class="tile ${STATUS_TILE_CLASS[bw?.status] ?? ''}"><h3>Weight</h3><span class="big">${bw?.delta != null ? bw.delta.toFixed(2) + ' kg' : '—'}</span><p>${bw?.avg == null ? 'not enough data' : bw.status === 'ok' ? 'on track' : bw.status}</p></div>
      <div class="tile"><h3>Next up</h3><span class="big">${nextLabel}</span><p>${esc(nextSub)}</p></div>
      ${alertText ? `<div class="tile bad"><h3>Alert</h3><span class="big">⚠</span><p>${esc(alertText)}</p></div>` : ''}
    </div>
    <h2>Effort &amp; volume</h2>
    <p class="hint">Both come from the plan itself, not from what was actually lifted, so they show the
    intended shape of the cycle: RPE (line) is planned intensity, working sets (bars) is planned volume,
    for the same week. Weeks 8 and 12 dip on purpose (deload and taper), not because of a drop in
    performance.</p>
    <div class="chart-wrap tall"><canvas id="effort-volume"></canvas></div>
  `;
}

function renderStrip(data, navigate) {
  const dot = (on, onIcon, offIcon) => icon(on ? onIcon : offIcon, on ? 'on' : '');
  const rows = data.weeks.map((w) => {
    const pain = w.painFlag || w.coach?.painFlags?.length;
    return `<div class="wk ${w.state} ${weekBadgeClass(w)}" data-week="${w.week}" title="${esc(w.phase)}">
      <b>S${w.week}</b>
      <span class="dots">${['A', 'B', 'C'].map((s) => dot(w.sessions[s], 'checkCircle2', 'circleDashed')).join('')}${dot(!!w.run, 'footprints', 'route')}</span>
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
    <div class="hero" id="hero"></div>
    ${data.weeks.some((w) => w.coach?.halt?.halted) ? `<div class="banner bad">Halted: ${esc(data.weeks.find((w) => w.coach?.halt?.halted).coach.halt.reasons.join('; '))}</div>` : ''}
    ${latestCoachWeek ? `<div class="banner info"><strong>Latest verdict (week ${latestCoachWeek.week}):</strong> ${esc(latestCoachWeek.coach.verdict ?? '—')}</div>` : ''}
    ${renderWhatsNext(data)}
    <h2>12-week strip</h2>
    <p class="hint">Each column is one week. The three small icons show whether Monday, Wednesday and
    Friday's session was logged; the last icon shows Sunday's run. Weeks 8 and 12 are marked — lighter
    by design, not a drop in performance. Tap a week to see it in full.</p>
    <div class="legend">
      <span>${icon('checkCircle2')} session logged</span>
      <span>${icon('circleDashed')} session pending</span>
      <span>${icon('footprints')} run logged</span>
      <span>${icon('route')} run pending</span>
      <span class="badge warn">deload/taper</span>
      <span class="badge bad">pain</span>
    </div>
    <div id="strip"></div>
  `;

  document.getElementById('hero').innerHTML = renderHero(data);
  document.getElementById('strip').replaceWith(renderStrip(data, navigate));

  const cw = data.cycle.currentWeek;
  const weeks = data.weeks.map((w) => w.week);
  const t = theme();

  const effortVolume = makeChart(document.getElementById('effort-volume'), {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: [
        {
          type: 'bar', label: 'Planned sets', data: data.weeks.map((w) => ({ x: w.week, y: w.plannedSets })),
          backgroundColor: t.accent + '99', yAxisID: 'y', unit: ' sets', order: 0,
        },
        {
          type: 'line', label: 'Planned RPE', data: data.weeks.map((w) => ({ x: w.week, y: w.plannedRpe })),
          borderColor: t.done, backgroundColor: t.done, pointRadius: 3, tension: 0, yAxisID: 'y1', unit: ' RPE', order: 1,
          segment: { borderDash: (c) => (c.p1DataIndex + 1 > cw ? [6, 4] : undefined) },
        },
      ],
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: weekAxis(12, { title: 'Week' }),
        y: { position: 'left', beginAtZero: true, suggestedMax: 150, grid: { color: t.line }, ticks: { color: t.muted }, title: axisTitle('Working sets') },
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

  charts.push(effortVolume);
  return () => charts.forEach((c) => c.destroy());
}
