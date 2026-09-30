import { esc, fmtKg, fmtDate } from '../lib/format.js';
import { icon } from '../lib/icons.js';

const SESSION_FOCUS = { A: 'Chest, Shoulders & Triceps', B: 'Legs & Core', C: 'Back, Biceps & Rear Delts' };
const DAY_NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

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
    return `<h2>What's next</h2><p class="muted">All sessions logged for this week. Nice.</p>`;
  }
  if (action.type === 'run') {
    return `<h2>What's next</h2><p>Sunday run — target: ${esc(week.runTarget ?? '—')}</p>`;
  }

  const prescription = week.coach?.prescription ?? prev?.coach?.next ?? null;
  const rows = prescription?.[action.session];
  if (rows) {
    return `<h2>What's next: session ${action.session}</h2>${renderPrescriptionRows(rows, data.exercises)}`;
  }
  if (week.planned?.rule) {
    return `<h2>What's next: session ${action.session}</h2><p>${esc(week.planned.rule)}</p>
      <p class="muted"><a href="#/week/${week.week}">Full week ${week.week} plan →</a></p>`;
  }
  const base = week.planned?.[action.session];
  return `<h2>What's next: session ${action.session}</h2>
    <p class="muted">No coach-assigned load yet — base plan shown.</p>
    ${renderPrescriptionRows(base?.map((r) => ({ ex: r.ex, sets: r.scheme.sets ?? '?', reps: r.scheme.reps, seconds: r.scheme.seconds, repsMax: r.scheme.repsMax })) ?? [], data.exercises)}`;
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
    <div class="hero-head">
      <p class="hint">Comepaolo Trainer tracks a 12-week body-recomposition cycle coached by Claude every
      Saturday, who reads Hevy, decides next week's loads and sends a report. This page shows where the
      week stands right now; the tabs above dig into weight, exercises, running and the coach's decisions.</p>
      <div class="tile tile-compact"><h3>Updated</h3><p>${new Date(data.generatedAt).toLocaleString('en-GB')}</p></div>
    </div>
    <div class="tiles">
      <div class="tile"><h3>Phase</h3><span class="big">Week ${cw} of 12</span><p>${esc(week?.phase ?? '—')}</p></div>
      <div class="tile"><h3>This week</h3><span class="big">${week?.gymDone ?? 0}/3</span><p>${week?.run ? 'run logged' : 'run pending'}</p></div>
      <div class="tile ${STATUS_TILE_CLASS[bw?.status] ?? ''}"><h3>Weight</h3><span class="big">${bw?.delta != null ? bw.delta.toFixed(2) + ' kg' : '—'}</span><p>${bw?.avg == null ? 'not enough data' : bw.status === 'ok' ? 'on track' : bw.status}</p></div>
      <div class="tile"><h3>Next up</h3><span class="big">${nextLabel}</span><p>${esc(nextSub)}</p></div>
      ${alertText ? `<div class="tile bad"><h3>Alert</h3><span class="big">⚠</span><p>${esc(alertText)}</p></div>` : ''}
    </div>
  `;
}

function weekBlurb(week) {
  const parts = [`${week.volume} volume`];
  if (week.block) parts.push(`block ${week.block}`);
  parts.push(`RIR ${week.rir}`, `${week.reps} reps`, `${week.rest} rest`);
  return parts.join(' · ') + (week.technique ? ` — ${week.technique}.` : '.');
}

function plannedSetsFor(rows) {
  return (rows ?? []).reduce((n, r) => n + (r.scheme.sets ?? 0), 0);
}

const descHtml = (text) => (text ? `<p class="desc" lang="it">${esc(text)}</p>` : '');

function sessionTile(s, i, week, workoutsById, data, note) {
  const w = week.sessions[s] ? workoutsById.get(week.sessions[s]) : null;
  if (w) {
    const m = w.title.match(/^S\d+\s+[ABC]\s*—\s*(.+)$/);
    const title = m ? m[1] : SESSION_FOCUS[s];
    const sets = w.exercises.reduce((n, e) => n + e.summary.workingSets, 0);
    const volume = Math.round(w.exercises.reduce((n, e) => n + e.summary.volumeKg, 0));
    return `<a class="card" href="#/workouts/${w.id}" data-id="${w.id}" style="text-decoration:none;color:inherit;display:block">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div style="min-width:0">
          <span class="eyebrow">Session ${s}</span>
          <strong>${esc(title)}</strong>
          ${descHtml(note)}
          <p class="muted" style="margin:2px 0 0;font-size:.85rem">${fmtDate(w.date)} · ${sets} sets · ${volume.toLocaleString('en-GB')}kg · ${w.durationMin}min</p>
        </div>
        <span class="badge done">done</span>
      </div>
    </a>`;
  }
  return `<div class="card planned">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
      <div style="min-width:0">
        <span class="eyebrow">Session ${s}</span>
        <strong>${esc(SESSION_FOCUS[s])}</strong>
        ${descHtml(note)}
        <p class="muted" style="margin:2px 0 0;font-size:.85rem">Planned for ${DAY_NAMES[data.cycle.gymDays[i]]} · ${plannedSetsFor(week.planned?.[s])} sets</p>
      </div>
      <span class="badge muted">planned</span>
    </div>
  </div>`;
}

function runTile(week, data, note) {
  if (week.run) {
    const date = data.runs.find((r) => r.id === week.run.id)?.date;
    return `<a class="card" href="#/workouts/${week.run.id}" data-id="${week.run.id}" style="text-decoration:none;color:inherit;display:block">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div style="min-width:0">
          <span class="eyebrow">Run</span>
          <strong>Sunday run</strong>
          ${descHtml(note)}
          <p class="muted" style="margin:2px 0 0;font-size:.85rem">${date ? fmtDate(date) + ' · ' : ''}${week.run.km}km · ${week.run.minutes}min · ${week.run.paceMinPerKm}/km</p>
        </div>
        <span class="badge done">done</span>
      </div>
    </a>`;
  }
  return `<div class="card planned">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
      <div style="min-width:0">
        <span class="eyebrow">Run</span>
        <strong>${esc(week.runTarget ?? '—')}</strong>
        ${descHtml(note)}
        <p class="muted" style="margin:2px 0 0;font-size:.85rem">Planned for ${DAY_NAMES[data.cycle.runDay]}</p>
      </div>
      <span class="badge muted">planned</span>
    </div>
  </div>`;
}

function renderCurrentWeek(data, workoutsById) {
  const cw = data.cycle.currentWeek;
  const week = data.weeks[cw - 1];
  if (!week) return '';
  const notes = data.routineNotes?.week === cw ? data.routineNotes : null;
  const tiles = ['A', 'B', 'C'].map((s, i) => sessionTile(s, i, week, workoutsById, data, notes?.[s])).join('') + runTile(week, data, notes?.run);
  return `
    <h2>Week ${cw}: ${esc(week.phase)}</h2>
    <p class="hint">${esc(weekBlurb(week))}</p>
    <div class="cards quad">${tiles}</div>
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
  const { data, navigate, workoutsById } = ctx;

  container.innerHTML = `
    <h1>Overview</h1>
    ${renderHero(data)}
    ${renderCurrentWeek(data, workoutsById)}
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
    ${data.weeks.some((w) => w.coach?.halt?.halted) ? `<div class="banner bad">Halted: ${esc(data.weeks.find((w) => w.coach?.halt?.halted).coach.halt.reasons.join('; '))}</div>` : ''}
    ${renderWhatsNext(data)}
  `;

  document.getElementById('strip').replaceWith(renderStrip(data, navigate));
}
