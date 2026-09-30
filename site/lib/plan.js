import { esc, fmtKg } from './format.js';

export const SESSION_FOCUS = { A: 'Chest, Shoulders & Triceps', B: 'Legs & Core', C: 'Back, Biceps & Rear Delts' };
export const DAY_NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

export function weekBlurb(week) {
  const parts = [`${week.volume} volume`];
  if (week.block) parts.push(`block ${week.block}`);
  parts.push(`RIR ${week.rir}`, `${week.reps} reps`, `${week.rest} rest`);
  return parts.join(' · ') + (week.technique ? ` — ${week.technique}.` : '.');
}

export function plannedSetsFor(rows) {
  return (rows ?? []).reduce((n, r) => n + (r.scheme.sets ?? 0), 0);
}

// What a session asks for in a given week: the coach's assigned loads when there are any
// (this week's prescription, else last week's `next`), else the week's {rule}, else the base plan.
export function sessionRows(data, weekNum, s) {
  const week = data.weeks[weekNum - 1];
  if (!week) return null;
  const coach = week.coach?.prescription?.[s] ?? data.weeks[weekNum - 2]?.coach?.next?.[s] ?? null;
  if (coach) return { source: 'coach', rows: coach };
  if (week.planned?.rule) return { source: 'rule', rule: week.planned.rule, rows: [] };
  return {
    source: 'plan',
    rows: (week.planned?.[s] ?? []).map((r) => ({
      ex: r.ex, sets: r.scheme.sets, reps: r.scheme.reps, seconds: r.scheme.seconds, repsMax: r.scheme.repsMax, raw: r.scheme.raw,
    })),
  };
}

const schemeText = (r) => (r.sets != null && (r.reps != null || r.seconds != null)
  ? `${r.sets}×${r.reps ?? r.seconds + 's'}${r.repsMax ? '-' + r.repsMax : ''}`
  : (r.raw ?? '—'));

export function prescriptionTable(rows, exercises) {
  if (!rows?.length) return '<p class="muted">No prescription rows.</p>';
  return `<table class="tbl"><thead><tr><th>Exercise</th><th class="num">Sets×Reps</th><th class="num">Load</th></tr></thead><tbody>
    ${rows.map((r) => `<tr>
      <td>${esc(exercises[r.ex]?.name ?? r.ex)}</td>
      <td class="num">${esc(schemeText(r))}</td>
      <td class="num">${r.kgPerSet ? r.kgPerSet.map(fmtKg).join('/') : fmtKg(r.kg)}</td>
    </tr>`).join('')}
  </tbody></table>`;
}
