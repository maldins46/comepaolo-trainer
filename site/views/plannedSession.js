import { esc } from '../lib/format.js';
import { SESSION_FOCUS, DAY_NAMES, weekBlurb, plannedSetsFor, sessionRows, prescriptionTable } from '../lib/plan.js';

const SOURCE_HINT = {
  coach: 'Loads the coach assigned for this session.',
  plan: 'No coach-assigned loads yet: this is the base plan.',
};

function noteBlock(note) {
  return note ? `<h2>Coach's note</h2><div class="card" lang="it"><p>${esc(note)}</p></div>` : '';
}

function renderRun(week, note, data) {
  return `
    <h1>Sunday run</h1>
    <p class="muted" style="margin:0">Week ${week.week} · Planned for ${DAY_NAMES[data.cycle.runDay]}</p>
    ${week.run ? `<div class="banner info">Already logged: <a href="#/workouts/${week.run.id}">open the run</a>.</div>` : ''}
    <h2>Target</h2>
    <p>${esc(week.runTarget ?? '—')}${week.runTargetMinutes ? ` (${week.runTargetMinutes} min)` : ''}</p>
    ${noteBlock(note)}`;
}

function renderSession(week, s, note, data) {
  const plan = sessionRows(data, week.week, s);
  const logged = week.sessions[s];
  const dayName = DAY_NAMES[data.cycle.gymDays[['A', 'B', 'C'].indexOf(s)]];
  const sets = plannedSetsFor(week.planned?.[s]);
  return `
    <h1>Session ${s}: ${esc(SESSION_FOCUS[s])}</h1>
    <p class="muted" style="margin:0">Week ${week.week} · Planned for ${dayName}${sets ? ` · ${sets} sets` : ''}</p>
    ${logged ? `<div class="banner info">Already logged: <a href="#/workouts/${logged}">open the workout</a>.</div>` : ''}
    <p class="hint" style="margin-top:12px">${esc(weekBlurb(week))}</p>
    ${noteBlock(note)}
    <h2>Prescription</h2>
    ${plan.source === 'rule'
      ? `<p>${esc(plan.rule)}</p>`
      : `<p class="hint">${SOURCE_HINT[plan.source]}</p>${prescriptionTable(plan.rows, data.exercises)}`}`;
}

export function render(container, ctx, params) {
  const { data } = ctx;
  const week = data.weeks[+params.n - 1];
  const s = params.s;
  if (!week) {
    container.innerHTML = '<p class="muted">No such week.</p>';
    return;
  }
  const notes = data.routineNotes?.week === week.week ? data.routineNotes : null;
  container.innerHTML = s === 'run'
    ? renderRun(week, notes?.run, data)
    : renderSession(week, s, notes?.[s], data);
}
