// twoByTwoProgress / heldForWeeks return "no data" (null / 0) when no coach-file weeks exist for
// this exercise yet, per the domain rule: if a week has no coach file, show nothing rather than guessing.

export function twoByTwoProgress(series) {
  const last = [...series].reverse().find((p) => p.progression?.twoByTwo);
  return last ? { ...last.progression.twoByTwo, week: last.week } : null;
}

export function heldForWeeks(series) {
  const byWeek = new Map();
  for (const p of series) if (p.progression) byWeek.set(p.week, p.progression); // A+C same week share one decision
  const weeks = [...byWeek.entries()].sort((a, b) => b[0] - a[0]);
  let n = 0;
  for (const [, prog] of weeks) {
    if (prog.action === 'raise') break;
    n++;
  }
  return n;
}

// Top load of the last week with data vs the week before it (an exercise trained in both A and C
// counts once per week, at its heaviest session). null until two weeks exist.
export function weightTrend(series) {
  const byWeek = new Map();
  for (const p of series) {
    if (p.topKg == null) continue;
    byWeek.set(p.week, Math.max(byWeek.get(p.week) ?? -Infinity, p.topKg));
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  if (weeks.length < 2) return null;
  const [prevWeek, lastWeek] = weeks.slice(-2);
  const delta = +(byWeek.get(lastWeek) - byWeek.get(prevWeek)).toFixed(2);
  return { dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same', delta, prevWeek, lastWeek };
}
