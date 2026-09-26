import { esc, fmtKg, fmtDate, sourceLabel } from '../lib/format.js';
import { renderMarkdown } from '../lib/markdown.js';

function overrideRow(o) {
  const tag = o.permanent ? '<span class="badge muted">permanent</span>' : `<span class="badge muted">since ${esc(o.from)}</span>`;
  return `<p lang="it">${esc(o.text)} ${tag}</p>`;
}

function sessionTable(session, workout, prescriptionRows, exercises) {
  if (!workout) return `<p class="muted">Not logged.</p>`;
  const bySession = new Map((prescriptionRows ?? []).map((r) => [r.ex, r]));
  return `<table class="tbl">
    <thead><tr><th>Exercise</th><th class="num">Prescribed</th><th class="num">Actual</th><th class="num">Reps</th></tr></thead>
    <tbody>${workout.exercises.map((e) => {
      const p = bySession.get(e.key);
      const prescribed = p ? (p.kgPerSet ? p.kgPerSet.map(fmtKg).join('/') : fmtKg(p.kg)) : '—';
      const actual = e.sets.filter((s) => s.type !== 'warmup').map((s) => fmtKg(s.kg)).join('/');
      const reps = e.sets.filter((s) => s.type !== 'warmup').map((s) => s.reps ?? (s.seconds ? s.seconds + 's' : '—')).join('/');
      return `<tr><td>${esc(exercises[e.key]?.name ?? e.hevyTitle)}</td><td class="num">${prescribed}</td><td class="num">${actual}</td><td class="num">${reps}</td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

export function render(container, ctx, params) {
  const { data, workoutsById } = ctx;
  const n = +params.n;
  const week = data.weeks[n - 1];

  if (!week || n < 1 || n > data.cycle.weeks) {
    container.innerHTML = `<p class="muted">No such week.</p>`;
    return;
  }

  const isFuture = week.state === 'future';
  const isBackfill = week.coach?.mode === 'backfill';
  const isDeload = week.week === 8;
  const isTaper = week.week === 12;

  const banners = [];
  if (isDeload) banners.push(['warn', 'Deload week — lighter by design, not a drop in performance.']);
  if (isTaper) banners.push(['warn', 'Taper week — lighter by design, not a drop in performance.']);
  if (week.painFlag || week.coach?.painFlags?.length) banners.push(['bad', 'Pain flagged this week.']);
  if (week.coach?.halt?.halted) banners.push(['bad', `Halted: ${week.coach.halt.reasons.join('; ')}`]);
  if (isBackfill) banners.push(['info', 'Backfilled week — reconstructed by hand. Null loads mean unknown, not zero.']);

  const sessionsHtml = isFuture
    ? `<p class="muted">Future week — showing plan only.</p>${week.planned?.rule ? `<p>${esc(week.planned.rule)}</p>` : ''}`
    : ['A', 'B', 'C'].map((s) => `
        <h3>Session ${s}</h3>
        ${sessionTable(s, workoutsById.get(week.sessions[s]), week.coach?.prescription?.[s], data.exercises)}
      `).join('');

  container.innerHTML = `
    <p><a href="#/">← Overview</a></p>
    <h1>Week ${week.week} — ${esc(week.phase)}</h1>
    <p class="muted" style="margin:0">${week.range.start} – ${week.range.end}</p>
    ${banners.map(([kind, text]) => `<div class="banner ${kind}">${esc(text)}</div>`).join('')}
    ${isBackfill && week.coach?.backfillNotes ? `<div class="card" lang="it">${esc(week.coach.backfillNotes)}</div>` : ''}
    <h2>Sessions</h2>
    ${sessionsHtml}
    <h2>Feedback</h2>
    ${week.feedback.length ? week.feedback.map((f) => `<div class="card" lang="it" style="margin-bottom:8px"><span class="badge muted">${esc(sourceLabel(f.source))}</span> <span class="muted">${fmtDate(f.date)}</span><p style="margin:6px 0 0">${esc(f.text)}</p></div>`).join('') : '<p class="muted">No feedback logged.</p>'}
    <h2>Coach report</h2>
    ${week.report ? `<div class="card" lang="it">${renderMarkdown(week.report.markdown)}</div>` : '<p class="muted">No report for this week yet.</p>'}
    ${week.overridesActive.length ? `<h2>Overrides active</h2>${week.overridesActive.map(overrideRow).join('')}` : ''}
  `;
}
