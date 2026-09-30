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

const round05 = (x) => Math.round(x * 2) / 2;

// Rough estimate of the top load for every remaining week, anchored on the last logged week (or on
// the coach's prescription for the next week when there is one). It is NOT a prescription: the coach
// decides week by week. Model, from the plan's own rules:
//   - inside a block the load moves by the athlete's own average weekly gain so far (flat if none, and
//     never a drop: early corrections like a first week that started too heavy aren't a trend);
//   - block changes (weeks 4 and 9) jump ~12.5% (the plan says 10-15% because the rep range drops);
//   - week 8 (deload) repeats week 7's load; week 12 (taper) is 10% under week 11.
// Assisted exercises skip the block jump (their load is assistance, lower is better). Weeks where the
// exercise isn't in the program (`inProgram(week)` false) get no point and leave the load untouched;
// only weeks from `fromWeek` (the current week) onward are returned, past weeks aren't "projected".
export function projectLoads({ series, maxWeek = 12, nextWeekKg = null, assisted = false, inProgram = () => true, fromWeek = 1, blockStarts = [4, 9], deload = 8, taper = 12 }) {
  const top = new Map();
  for (const p of series) if (p.topKg != null) top.set(p.week, Math.max(top.get(p.week) ?? -Infinity, p.topKg));
  const weeks = [...top.keys()].sort((a, b) => a - b);
  if (!weeks.length) return [];
  const lastWeek = weeks.at(-1);
  if (!(top.get(lastWeek) > 0)) return [];

  const special = new Set([...blockStarts, deload, deload + 1, taper]);
  const deltas = [];
  for (const w of weeks) if (top.has(w - 1) && !special.has(w)) deltas.push(top.get(w) - top.get(w - 1));
  const mean = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const slope = assisted ? Math.max(-5, Math.min(0, mean)) : Math.min(5, Math.max(0, mean));

  const kg = new Map(top);
  const out = [];
  let cur = top.get(lastWeek);
  for (let w = lastWeek + 1; w <= maxWeek; w++) {
    if (!inProgram(w)) continue;
    if (w === lastWeek + 1 && nextWeekKg != null) cur = nextWeekKg;
    else if (w === deload) cur = kg.get(w - 1);
    else if (w === taper) cur = kg.get(w - 1) * 0.9;
    else if (blockStarts.includes(w) && !assisted) cur = cur * 1.125;
    else cur += slope;
    cur = Math.max(0, round05(cur));
    kg.set(w, cur);
    if (w >= fromWeek) out.push({ week: w, kg: cur });
  }
  return out;
}
