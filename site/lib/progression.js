// Both return "no data" (null / 0) when no coach-file weeks exist for this exercise yet,
// per the domain rule: if a week has no coach file, show nothing rather than guessing.

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
