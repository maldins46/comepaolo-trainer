import { esc, fmtKg, actionLabel, actionBadgeClass } from '../lib/format.js';

const ACTIONS = ['raise', 'hold', 'lower', 'reset', 'transition', 'pain', 'skipped'];

function decisionRow(d, exercises) {
  const kg = d.kgPerSet ? `${fmtKg(d.fromKg)} → ${d.kgPerSet.map(fmtKg).join('/')}` : `${fmtKg(d.fromKg)} → ${fmtKg(d.toKg)}`;
  return `<tr data-ex="${d.ex}" data-action="${d.action}">
    <td><a href="#/week/${d.week}">S${d.week}</a></td>
    <td>${esc(exercises[d.ex]?.name ?? d.ex)}</td>
    <td><span class="badge ${actionBadgeClass(d.action)}">${esc(actionLabel(d.action))}</span></td>
    <td class="num">${kg}</td>
    <td class="reason">${esc(d.reason ?? '')}</td>
    <td>${d.twoByTwo ? `${d.twoByTwo.qualifyingWeeks}/${d.twoByTwo.required}` : ''}</td>
  </tr>`;
}

export function render(container, ctx) {
  const { data } = ctx;
  const rows = data.weeks.flatMap((w) => (w.coach?.decisions ?? []).map((d) => ({ ...d, week: w.week })));
  rows.sort((a, b) => b.week - a.week);
  const gapWeeks = data.weeks.filter((w) => !w.coach && w.state !== 'future').map((w) => w.week);

  const halts = data.weeks.filter((w) => w.coach?.halt?.halted).map((w) => ({ week: w.week, reasons: w.coach.halt.reasons }));
  const nutrition = data.weeks.filter((w) => w.coach?.nutrition?.suggestion).map((w) => ({ week: w.week, text: w.coach.nutrition.suggestion }));
  const overridesApplied = data.weeks.filter((w) => w.coach?.overridesApplied?.length).flatMap((w) => w.coach.overridesApplied.map((text) => ({ week: w.week, text })));

  container.innerHTML = `
    <h1>Coach decisions</h1>
    <p class="hint">Every load change the coach made, most recent first. A decision is made at the end of
    a week and applies from the next one. The 2×2 rule raises a load once it's cleared the top of the rep
    range for two sessions in a row, twice; "held" means it hasn't yet. Weeks with no coach file are listed
    as gaps below, not silently skipped. Filter by exercise or action to narrow the log.</p>
    <div class="filters">
      <select id="filter-ex"><option value="">All exercises</option>${Object.entries(data.exercises).map(([k, m]) => `<option value="${k}">${esc(m.name)}</option>`).join('')}</select>
      <select id="filter-action"><option value="">All actions</option>${ACTIONS.map((a) => `<option value="${a}">${esc(actionLabel(a))}</option>`).join('')}</select>
    </div>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Week</th><th>Exercise</th><th>Action</th><th class="num">From → To</th><th>Reason</th><th>2×2</th></tr></thead>
      <tbody id="rows">${rows.map((d) => decisionRow(d, data.exercises)).join('')}</tbody>
    </table></div>
    ${gapWeeks.length ? `<p class="muted">No coach file: ${gapWeeks.map((w) => 'S' + w).join(', ')}</p>` : ''}

    ${halts.length ? `<h2>Halts</h2>${halts.map((h) => `<div class="banner bad">Week ${h.week}: ${esc(h.reasons.join('; '))}</div>`).join('')}` : ''}
    ${nutrition.length ? `<h2>Nutrition suggestions</h2>${nutrition.map((n) => `<p><strong>Week ${n.week}:</strong> ${esc(n.text)}</p>`).join('')}` : ''}
    ${overridesApplied.length ? `<h2>Overrides applied</h2>${overridesApplied.map((o) => `<p lang="it"><strong>Week ${o.week}:</strong> ${esc(o.text)}</p>`).join('')}` : ''}
  `;

  const exSel = document.getElementById('filter-ex');
  const actionSel = document.getElementById('filter-action');
  const applyFilter = () => {
    const ex = exSel.value, action = actionSel.value;
    for (const tr of document.querySelectorAll('#rows tr')) {
      tr.hidden = (ex && tr.dataset.ex !== ex) || (action && tr.dataset.action !== action);
    }
  };
  exSel.addEventListener('change', applyFilter);
  actionSel.addEventListener('change', applyFilter);
}
