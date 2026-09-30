export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const dayNum = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;

// Fractional week position (e.g. week 3.43 = Wednesday of week 3) for placing daily points
// on the same linear week axis the weekly-average line uses.
export function fractionalWeek(date, cycleStart) {
  const offset = dayNum(date) - dayNum(cycleStart);
  return Math.floor(offset / 7) + 1 + (((offset % 7) + 7) % 7) / 7;
}

export function fmtDate(iso) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

export function fmtKg(kg) {
  return kg == null ? '—' : `${kg}kg`;
}

const SOURCE_LABELS = {
  'hevy-workout': 'Workout note',
  'hevy-exercise': 'Exercise note',
  email: 'Email to coach',
  hevy: 'Hevy note (via coach)',
};

export function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? 'Note';
}

const ACTION_LABELS = {
  raise: 'Raised', hold: 'Held', lower: 'Lowered', reset: 'Reset',
  transition: 'Block transition', pain: 'Pain', skipped: 'Skipped',
};

export function actionLabel(action) {
  return ACTION_LABELS[action] ?? action;
}

export function actionBadgeClass(action) {
  if (action === 'raise') return 'done';
  if (action === 'lower' || action === 'pain') return 'bad';
  if (action === 'reset' || action === 'transition') return 'warn';
  return 'muted';
}
