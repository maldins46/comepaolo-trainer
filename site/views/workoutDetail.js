import { esc, fmtDate, fmtKg } from '../lib/format.js';
import { kindIcon } from '../lib/icons.js';

function setsCell(sets) {
  return sets.filter((s) => s.type !== 'warmup')
    .map((s) => `${fmtKg(s.kg)}×${s.reps ?? (s.seconds ? s.seconds + 's' : '—')}`)
    .join(', ') || '—';
}

function exerciseRow(e, exercises) {
  const meta = exercises[e.key];
  return `<tr>
    <td>${kindIcon(meta?.kind ?? '')} ${esc(meta?.name ?? e.hevyTitle)}</td>
    <td>${setsCell(e.sets)}</td>
    <td class="num">${e.summary.bestE1rm ?? '—'}</td>
    <td lang="it">${e.notes ? esc(e.notes) : ''}</td>
  </tr>`;
}

export function render(container, ctx, params) {
  const { data, workoutsById } = ctx;
  const w = workoutsById.get(params.id);

  if (!w) {
    container.innerHTML = `<p class="muted">No such workout.</p>`;
    return;
  }

  const banners = [];
  if (w.painFlag) banners.push(['bad', 'Pain flagged in this session.']);
  if (w.warning) banners.push(['warn', w.warning]);

  const kindLabel = w.kind === 'run' ? 'Run' : w.kind === 'gym' ? `Session ${w.session}` : 'Other';

  container.innerHTML = `
    <h1>${esc(w.title)}</h1>
    <p class="muted" style="margin:0">${fmtDate(w.date)} · ${kindLabel} · ${w.durationMin}min</p>
    ${banners.map(([kind, text]) => `<div class="banner ${kind}">${esc(text)}</div>`).join('')}
    ${w.description ? `<p lang="it" style="margin-top:12px">${esc(w.description)}</p>` : ''}
  `;

  if (w.kind === 'run') {
    container.insertAdjacentHTML('beforeend', w.run ? `
      <div class="tiles">
        <div class="tile"><h3>Distance</h3><span class="big">${w.run.km}km</span></div>
        <div class="tile"><h3>Time</h3><span class="big">${w.run.minutes}min</span></div>
        <div class="tile"><h3>Pace</h3><span class="big">${w.run.paceMinPerKm}/km</span></div>
      </div>` : '<p class="muted">No run data.</p>');
    return;
  }

  const totalVolume = Math.round(w.exercises.reduce((n, e) => n + e.summary.volumeKg, 0));
  const totalSets = w.exercises.reduce((n, e) => n + e.summary.workingSets, 0);
  const anyDropped = w.exercises.some((e) => e.summary.droppedWithinSession);

  container.insertAdjacentHTML('beforeend', `
    <div class="tiles">
      <div class="tile"><h3>Exercises</h3><span class="big">${w.exercises.length}</span></div>
      <div class="tile"><h3>Working sets</h3><span class="big">${totalSets}</span></div>
      <div class="tile"><h3>Volume</h3><span class="big">${totalVolume.toLocaleString('en-GB')}kg</span></div>
      <div class="tile"><h3>Duration</h3><span class="big">${w.durationMin}min</span></div>
    </div>
    ${anyDropped ? '<p class="hint">At least one exercise had its load drop set to set within this session.</p>' : ''}
    <table class="tbl">
      <thead><tr><th>Exercise</th><th>Sets</th><th class="num">e1RM</th><th>Note</th></tr></thead>
      <tbody>${w.exercises.map((e) => exerciseRow(e, data.exercises)).join('')}</tbody>
    </table>
  `);
}
