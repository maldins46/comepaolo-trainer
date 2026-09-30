// Turns raw Hevy + Drive data into the single data.json the site renders.
// Pure functions only: no network, no filesystem. Test with fixtures.
//
// Principles (mirrors the hevy-weekly-coach skill):
// - The coach's week JSON (Drive dati/SNN.json) is authoritative for decisions and prescriptions.
//   This file never re-implements the 2x2 rule; it only displays what the coach decided.
// - Bodyweight: one value per date (that is all Hevy stores). Weekly avg needs >= 3 days.
// - Dumbbell loads before plan.conventions.dumbbellTotalFrom were logged per hand -> doubled.

// ---------- dates ----------

export function localDate(iso, timeZone) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

const dayNum = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000;

export function cycleWeek(ymd, cycleStart) {
  // Week 1 = cycleStart (a Sunday) .. +6 days. Values < 1 are pre-cycle, > 12 post-cycle.
  return Math.floor((dayNum(ymd) - dayNum(cycleStart)) / 7) + 1;
}

// Weeks run Sunday..Saturday, but the athlete sometimes runs on the Saturday ahead of the Sunday
// slot: a Saturday run is the next week's run. Everything else stays in its own week.
export function workoutWeek(kind, ymd, cycleStart) {
  const offset = dayNum(ymd) - dayNum(cycleStart);
  const saturday = ((offset % 7) + 7) % 7 === 6;
  return Math.floor(offset / 7) + 1 + (kind === 'run' && saturday ? 1 : 0);
}

export function weekRange(week, cycleStart) {
  const start = dayNum(cycleStart) + (week - 1) * 7;
  const fmt = (d) => new Date(d * 86_400_000).toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(start + 6) };
}

// ---------- plan helpers ----------

export function parseScheme(s) {
  // "4x10" | "3x12/side" | "3x30s" | "4x8-10" | "3xmax" | "3x8 + 1x15" | "3 round + side plank"
  const m = /^(\d+)x(\d+)(?:-(\d+))?(s)?(\/side)?$/.exec(s.trim());
  if (!m) return { raw: s };
  const [, sets, a, b, secs, side] = m;
  return secs
    ? { raw: s, sets: +sets, seconds: +a }
    : { raw: s, sets: +sets, reps: +a, repsMax: b ? +b : undefined, perSide: !!side };
}

export function rirMidpoint(rirRaw) {
  // "3-4" -> 3.5, "3" -> 3, "0-1 last set" -> 0.5 (trailing qualifier text is ignored)
  const m = /^(\d+)(?:-(\d+))?/.exec(rirRaw.trim());
  if (!m) return null;
  const lo = +m[1], hi = m[2] != null ? +m[2] : lo;
  return (lo + hi) / 2;
}

export function plannedRpeForWeek(pw) {
  const mid = rirMidpoint(pw.rir);
  return mid == null ? null : +(10 - mid).toFixed(1);
}

// Raw scheme strings in plan.json that parseScheme() can't parse into a `sets` count.
// Small and fixed, so hardcoded rather than a fragile catch-all regex.
const SET_COUNT_OVERRIDES = { '3xmax': 3, '3x8 + 1x15': 4, '3 rounds + side plank': 3 };

export function setsInScheme(raw) {
  if (raw in SET_COUNT_OVERRIDES) return SET_COUNT_OVERRIDES[raw];
  const parsed = parseScheme(raw);
  if (parsed.sets != null) return parsed.sets;
  return +(/^(\d+)/.exec(raw.trim())?.[1] ?? 0);
}

export function plannedSetsForWeek(plan, week) {
  const planned = plannedSessions(plan, week);
  if (!planned) return null;
  if (planned.rule) {
    if (week === 8) {
      // Deload: "half the sets" of week 7.
      const w7 = plannedSetsForWeek(plan, 7);
      return w7 == null ? null : Math.round(w7 / 2);
    }
    if (week === 12) {
      // Taper: "3 sets" per block-3 exercise (any block-3 week has the same exercise list).
      const block3 = plannedSessions(plan, 9);
      return ['A', 'B', 'C'].reduce((n, s) => n + block3[s].length, 0) * 3;
    }
    return null;
  }
  return ['A', 'B', 'C'].reduce((total, s) =>
    total + planned[s].reduce((n, row) => n + setsInScheme(row.scheme.raw), 0), 0);
}

// Same rules as plannedSetsForWeek, kept per exercise so sets can be grouped by muscle.
export function plannedSetsByExercise(plan, week) {
  const planned = plannedSessions(plan, week);
  if (!planned) return {};
  const out = {};
  const add = (ex, n) => { out[ex] = (out[ex] ?? 0) + n; };
  if (planned.rule) {
    if (week === 8) {
      for (const [ex, n] of Object.entries(plannedSetsByExercise(plan, 7))) out[ex] = Math.round(n / 2);
    } else if (week === 12) {
      const block3 = plannedSessions(plan, 9);
      for (const s of ['A', 'B', 'C']) for (const row of block3[s]) add(row.ex, 3);
    }
    return out;
  }
  for (const s of ['A', 'B', 'C']) for (const row of planned[s]) add(row.ex, setsInScheme(row.scheme.raw));
  return out;
}

function byMuscle(plan, setsByKey) {
  const out = {};
  for (const [ex, n] of Object.entries(setsByKey)) {
    const muscle = plan.exercises[ex]?.muscle;
    if (muscle) out[muscle] = (out[muscle] ?? 0) + n;
  }
  return out;
}

export function blockForWeek(plan, week) {
  return Object.entries(plan.sessions).find(([, b]) => b.weeks.includes(week))?.[0] ?? null;
}

export function plannedSessions(plan, week) {
  // Base plan only (before coach adjustments). Deload/taper are rules, not tables.
  const key = blockForWeek(plan, week);
  if (!key) return null;
  const block = plan.sessions[key];
  if (block.rule) return { block: key, rule: block.rule };
  const idx = block.weeks.indexOf(week);
  const out = { block: key };
  for (const s of ['A', 'B', 'C']) {
    out[s] = block[s].map((row) => {
      const raw = row.sets.length === 1 ? row.sets[0] : row.sets[idx];
      return { ex: row.ex, scheme: parseScheme(raw), rest: row.rest, cutOrder: row.cutOrder };
    });
  }
  return out;
}

// ---------- exercise resolution ----------

export function makeResolver(plan, templateIds) {
  const byTitle = new Map();
  for (const [key, ex] of Object.entries(plan.exercises)) {
    for (const t of ex.hevy) byTitle.set(t.toLowerCase(), key);
  }
  return (templateId, title) =>
    templateIds[templateId] ?? byTitle.get((title ?? '').toLowerCase()) ?? null;
}

// ---------- workouts ----------

const SESSION_RE = /^S(\d{2})\s+([ABC])\b/;

function classifyWorkout(w, resolve) {
  const m = SESSION_RE.exec(w.title ?? '');
  if (m) return { kind: 'gym', session: m[2], titledWeek: +m[1] };
  const keys = (w.exercises ?? []).map((e) => resolve(e.exercise_template_id, e.title));
  if (keys.length && keys.every((k) => k === 'running')) return { kind: 'run' };
  if (!keys.length && /\b(corsa|running|run)\b/i.test(w.title ?? '')) return { kind: 'run' };
  return { kind: 'other' };
}

const epley = (w, r) => (w > 0 && r > 0 && r <= 15 ? +(w * (1 + r / 30)).toFixed(1) : null);
// The athlete writes notes in Italian: match Italian pain words. Soreness ("indolenzito") is intentionally not matched.
const PAIN_RE = /\b(dolore|male|fitta|pain)\b/i;

function normalizeExercise(e, { key, plan, date }) {
  const meta = key ? plan.exercises[key] : null;
  const isDumbbell = meta?.dumbbell || /\(dumbbell\)/i.test(e.title ?? '');
  const factor = isDumbbell && date < plan.conventions.dumbbellTotalFrom ? 2 : 1;
  const sets = (e.sets ?? []).map((s) => ({
    type: s.type,
    kg: s.weight_kg != null ? +(s.weight_kg * factor).toFixed(2) : null,
    reps: s.reps ?? null,
    seconds: s.duration_seconds ?? null,
    meters: s.distance_meters || null,
    rpe: s.rpe ?? null,
  }));
  const working = sets.filter((s) => s.type !== 'warmup');
  const loads = working.map((s) => s.kg ?? 0);
  return {
    key: key ?? `unmapped:${e.exercise_template_id}`,
    hevyTitle: e.title,
    templateId: e.exercise_template_id,
    notes: e.notes || null,
    doubledFromPerHand: factor === 2,
    sets,
    summary: {
      workingSets: working.length,
      topKg: loads.length ? Math.max(...loads) : null,
      minKg: loads.length ? Math.min(...loads) : null,
      reps: working.map((s) => s.reps),
      volumeKg: working.reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0),
      bestE1rm: Math.max(0, ...working.map((s) => epley(s.kg, s.reps) ?? 0)) || null,
      // Load dropping set to set = started too heavy (the pattern flagged in week 1-2 reports)
      droppedWithinSession: loads.length > 1 && loads.some((l, i) => i > 0 && l < loads[i - 1]),
    },
  };
}

export function normalizeWorkouts(raw, { plan, resolve }) {
  const tz = plan.cycle.timezone;
  return raw
    .map((w) => {
      const date = localDate(w.start_time, tz);
      const cls = classifyWorkout(w, resolve);
      const week = workoutWeek(cls.kind, date, plan.cycle.start);
      const exercises = (w.exercises ?? []).map((e) =>
        normalizeExercise(e, { key: resolve(e.exercise_template_id, e.title), plan, date }));
      const durationMin = Math.round((new Date(w.end_time) - new Date(w.start_time)) / 60000);
      const out = {
        id: w.id, title: w.title, date, week, ...cls, durationMin,
        description: w.description || null,
        exercises,
      };
      if (cls.kind === 'run') {
        const s = exercises[0]?.sets[0] ?? {};
        const km = s.meters ? s.meters / 1000 : null;
        const minutes = s.seconds ? s.seconds / 60 : durationMin;
        out.run = { km, minutes: +minutes.toFixed(1), paceMinPerKm: km ? +(minutes / km).toFixed(2) : null };
      }
      if (cls.kind === 'gym' && cls.titledWeek !== week) out.warning = `Titled S${String(cls.titledWeek).padStart(2, '0')} but done in week ${week}`;
      const texts = [w.description, ...exercises.map((e) => e.notes)].filter(Boolean);
      out.painFlag = texts.some((t) => PAIN_RE.test(t));
      return out;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- bodyweight ----------

export function normalizeBodyweight(raw, plan) {
  const days = raw
    .filter((m) => m.weight_kg != null)
    .map((m) => ({ date: m.date, kg: m.weight_kg, week: cycleWeek(m.date, plan.cycle.start) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byWeek = new Map();
  for (const d of days) {
    if (!byWeek.has(d.week)) byWeek.set(d.week, []);
    byWeek.get(d.week).push(d.kg);
  }
  const { minKgPerWeek, maxKgPerWeek, haltKgPerWeek } = plan.rules.weightLoss;
  const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, kgs]) => ({
    week,
    n: kgs.length,
    avg: kgs.length >= 3 ? +(kgs.reduce((a, b) => a + b, 0) / kgs.length).toFixed(2) : null,
  }));
  weeks.forEach((w, i) => {
    const prev = weeks[i - 1];
    w.delta = w.avg != null && prev?.avg != null && prev.week === w.week - 1 ? +(w.avg - prev.avg).toFixed(2) : null;
    const loss = w.delta != null ? -w.delta : null;
    w.status = loss == null ? 'n/a'
      : loss > haltKgPerWeek ? 'halt'
      : loss > maxKgPerWeek ? 'fast'
      : loss < minKgPerWeek ? 'slow'
      : 'ok';
  });
  return { days, weeks };
}

// ---------- Drive: reports, week data, overrides ----------

export function parseReports(files) {
  return files
    .map((f) => {
      const date = /^(\d{4}-\d{2}-\d{2})/.exec(f.name)?.[1] ?? f.createdTime?.slice(0, 10);
      const week = +(/Settimana\s+(\d+)/i.exec(f.name)?.[1] ?? NaN);
      const text = (f.text ?? '').replace(/\\([#*_\-])/g, '$1').replace(/\r/g, '').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
      const verdict = /^#\s.*\n+\**(.+?)\**\n/m.exec(text)?.[1]?.trim() ?? null;
      return { id: f.id, name: f.name, date, week: Number.isFinite(week) ? week : null, verdict, markdown: text };
    })
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}

export function parseWeekData(files) {
  const out = {};
  for (const f of files) {
    try {
      const json = JSON.parse(f.text.replace(/^```(?:json)?\s*|\s*```\s*$/g, '').trim());
      if (json.week) out[json.week] = json;
    } catch (e) {
      console.warn(`week data ${f.name}: invalid JSON (${e.message})`);
    }
  }
  return out;
}

export function parseOverrides(doc) {
  if (!doc?.text) return [];
  return doc.text.split('\n').map((l) => l.trim()).filter(Boolean).slice(1) // line 1 = format explanation
    .map((line) => {
      const m = /^(\d{4}-\d{2}-\d{2})\s*[·\-–]\s*(.+)$/.exec(line);
      return m ? { from: m[1], text: m[2], permanent: false } : { from: null, text: line, permanent: true };
    });
}

// ---------- routine notes ----------

// The coach's short description of each session, written on the Hevy routine. Hevy rewrites the
// routines every week, so this is only valid for the week named in the routine titles.
export function normalizeRoutineNotes(routines) {
  const text = (r) => String(r.notes ?? r.description ?? '').trim() || null;
  const out = { week: null, A: null, B: null, C: null, run: null };
  for (const r of routines ?? []) {
    const m = SESSION_RE.exec(r.title ?? '');
    if (m) {
      out.week = +m[1];
      out[m[2]] = text(r);
    } else if (/\b(corsa|running|run)\b/i.test(r.title ?? '')) {
      out.run = text(r);
    }
  }
  return out.week == null ? null : out;
}

// ---------- assemble ----------

export function buildData({ plan, templateIds, hevy, drive, now = new Date() }) {
  const resolve = makeResolver(plan, templateIds);
  const workouts = normalizeWorkouts(hevy.workouts ?? [], { plan, resolve });
  const bodyweight = normalizeBodyweight(hevy.bodyMeasurements ?? [], plan);
  const reports = parseReports(drive?.reports ?? []);
  const coach = parseWeekData(drive?.weekData ?? []);
  const overrides = parseOverrides(drive?.overrides);
  const routineNotes = normalizeRoutineNotes(hevy.routines);

  const today = localDate(now.toISOString(), plan.cycle.timezone);
  const currentWeek = cycleWeek(today, plan.cycle.start);

  const weeks = plan.weeks.map((pw) => {
    const inWeek = workouts.filter((w) => w.week === pw.week);
    const gym = inWeek.filter((w) => w.kind === 'gym');
    const run = inWeek.find((w) => w.kind === 'run') ?? null;
    const bw = bodyweight.weeks.find((b) => b.week === pw.week) ?? null;
    const report = reports.filter((r) => r.week === pw.week).at(-1) ?? null;
    const runPlan = plan.running.find((r) => r.weeks.includes(pw.week));
    return {
      ...pw,
      range: weekRange(pw.week, plan.cycle.start),
      state: pw.week < currentWeek ? 'done' : pw.week === currentWeek ? 'current' : 'future',
      planned: plannedSessions(plan, pw.week),
      plannedRpe: plannedRpeForWeek(pw),
      plannedSets: plannedSetsForWeek(plan, pw.week),
      setsByMuscle: {
        planned: byMuscle(plan, plannedSetsByExercise(plan, pw.week)),
        logged: byMuscle(plan, gym.flatMap((w) => w.exercises).reduce((acc, e) => {
          acc[e.key] = (acc[e.key] ?? 0) + e.summary.workingSets;
          return acc;
        }, {})),
      },
      runTarget: runPlan?.target ?? null,
      runTargetMinutes: runPlan?.targetMinutes ?? null,
      sessions: Object.fromEntries(['A', 'B', 'C'].map((s) => [s, gym.find((w) => w.session === s)?.id ?? null])),
      gymDone: new Set(gym.map((w) => w.session)).size,
      extraWorkouts: inWeek.filter((w) => w.kind === 'other').map((w) => w.id),
      run: run ? { id: run.id, ...run.run } : null,
      bodyweight: bw,
      feedback: inWeek.flatMap((w) => [
        w.description && { source: 'hevy-workout', workoutId: w.id, date: w.date, text: w.description },
        ...w.exercises.filter((e) => e.notes).map((e) => ({ source: 'hevy-exercise', workoutId: w.id, date: w.date, exercise: e.key, text: e.notes })),
      ].filter(Boolean)).concat(coach[pw.week]?.feedback ?? [])
        // the coach quotes Hevy notes too: keep the first occurrence of each text
        .filter((f, i, all) => all.findIndex((g) => g.text.trim() === f.text.trim()) === i),
      painFlag: inWeek.some((w) => w.painFlag),
      coach: coach[pw.week] ?? null,      // structured decisions (from SKILL addition)
      report,                             // Italian markdown report
      overridesActive: overrides.filter((o) => o.permanent || o.from <= weekRange(pw.week, plan.cycle.start).end),
    };
  });

  // Per-exercise time series across the whole cycle (and pre-cycle for context).
  const series = {};
  for (const w of workouts.filter((w) => w.kind === 'gym')) {
    for (const e of w.exercises) {
      if (e.key === 'stretching') continue;
      (series[e.key] ??= []).push({
        date: w.date, week: w.week, session: w.session, workoutId: w.id,
        topKg: e.summary.topKg, minKg: e.summary.minKg, reps: e.summary.reps,
        workingSets: e.summary.workingSets, bestE1rm: e.summary.bestE1rm,
        dropped: e.summary.droppedWithinSession, doubled: e.doubledFromPerHand,
        prescribed: coach[w.week]?.prescription?.[w.session]?.find((p) => p.ex === e.key) ?? null,
        progression: coach[w.week]?.decisions?.find((d) => d.ex === e.key) ?? null,
      });
    }
  }

  const unmapped = [...new Set(workouts.flatMap((w) => w.exercises.filter((e) => e.key.startsWith('unmapped:')).map((e) => `${e.templateId} ${e.hevyTitle}`)))];

  return {
    generatedAt: now.toISOString(),
    hevyFetchedAt: hevy.fetchedAt ?? null,
    cycle: { ...plan.cycle, currentWeek, today },
    rules: plan.rules,
    exercises: plan.exercises,
    muscleGroups: plan.muscleGroups,
    runningBaseline: plan.runningBaseline,
    weeks,
    workouts,
    series,
    bodyweight,
    runs: workouts.filter((w) => w.kind === 'run').map((w) => ({ date: w.date, week: w.week, id: w.id, ...w.run })),
    overrides,
    routineNotes,
    reports,
    quality: {
      routinesWithNotes: routineNotes ? ['A', 'B', 'C', 'run'].filter((k) => routineNotes[k]).length : 0,
      unmappedExercises: unmapped,
      weeksMissingCoachData: weeks.filter((w) => w.state === 'done' && !w.coach).map((w) => w.week),
      bodyweightDays: bodyweight.days.length,
    },
  };
}
