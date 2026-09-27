import { esc, fmtDate } from '../lib/format.js';
import { icon } from '../lib/icons.js';

function kindBadge(w) {
  if (w.kind === 'run') return `<span class="badge muted">${icon('footprints')} Run</span>`;
  if (w.kind === 'gym') return `<span class="badge muted">Session ${esc(w.session)}</span>`;
  return `<span class="badge muted">Other</span>`;
}

function summaryLine(w) {
  if (w.kind === 'run') {
    return w.run ? `${w.run.km}km · ${w.run.minutes}min · ${w.run.paceMinPerKm}/km` : '';
  }
  const sets = w.exercises.reduce((n, e) => n + e.summary.workingSets, 0);
  const volume = Math.round(w.exercises.reduce((n, e) => n + e.summary.volumeKg, 0));
  return `${w.exercises.length} exercises · ${sets} sets · ${volume.toLocaleString('en-GB')}kg · ${w.durationMin}min`;
}

export function render(container, ctx) {
  const { data, navigate } = ctx;
  const rows = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <h1>Workouts</h1>
    <p class="hint">Every logged session, most recent first — gym sessions, runs, and anything
    else Hevy recorded. Tap one for the full breakdown.</p>
    <div id="rows"></div>
  `;

  const rowsEl = document.createElement('div');
  rowsEl.className = 'cards';
  rowsEl.id = 'rows';
  rowsEl.innerHTML = rows.map((w) => `
    <a class="card" href="#/workouts/${w.id}" data-id="${w.id}" style="text-decoration:none;color:inherit;display:block">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div>
          <strong>${esc(w.title)}</strong>
          <p class="muted" style="margin:2px 0 0;font-size:.85rem">${fmtDate(w.date)} · S${w.week} · ${esc(summaryLine(w))}</p>
        </div>
        ${kindBadge(w)}
      </div>
      <div class="badge-row" style="display:flex;gap:6px;margin-top:6px">
        ${w.painFlag ? '<span class="badge bad">pain</span>' : ''}
        ${w.warning ? '<span class="badge warn">mismatched week</span>' : ''}
      </div>
    </a>`).join('');

  document.getElementById('rows').replaceWith(rowsEl);
  rowsEl.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (a) { e.preventDefault(); navigate(`#/workouts/${a.dataset.id}`); }
  });
}
