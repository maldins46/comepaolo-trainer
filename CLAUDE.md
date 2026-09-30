# Hevy dashboard — project brief for Claude Code

Personal, single-user dashboard for a 12-week body-recomposition plan (cycle start
2026-09-06, Sunday-to-Saturday weeks, Europe/Rome). The training itself is run by a
separate Claude skill, `hevy-weekly-coach`, which every Saturday reads Hevy, decides next
week's loads with a strict progression rule, writes the routines back to Hevy and sends a
report (written in Italian). This repo only **displays** that process. It never writes to Hevy and never
re-implements the coach's decisions.

## Architecture

```
GitHub Action (daily 09:00 Europe/Rome, DST-proof; also on push and manual run)
  npm run fetch    Hevy API + Google Drive (service account)  -> data/raw/*.json   (gitignored)
  npm run build    normalise -> data/data.json (gitignored) -> encrypt -> dist/data.enc.json
  deploy dist/ to GitHub Pages (public URL, encrypted payload, passphrase in the browser)
```

Zero runtime dependencies, Node 22. Keep it that way unless a dependency clearly pays for
itself; the whole pipeline should stay readable in one sitting.

| Path | Role |
|---|---|
| `plan/plan.json` | The 12-week plan as data: weeks, blocks, sessions, set schemes per week, running targets, rules. Source: the skill's `references/plan.md`. No personal stats in here: the repo is public. |
| `plan/template-ids.json` | Hevy `exercise_template_id` -> plan key. Unknown ids fall back to title matching. `npm run build:data` prints unmapped ones: add them here. |
| `scripts/lib/hevy.js` | Paginated Hevy client. |
| `scripts/lib/drive.js` | Drive read-only client, service-account JWT signed with `node:crypto`. |
| `scripts/lib/normalize.js` | **All** data shaping. Pure functions, unit-tested. |
| `scripts/lib/crypto.js` | gzip + AES-256-GCM, PBKDF2-SHA256 600k, fixed per-repo salt. |
| `site/index.html` | Password gate + decrypt, then hands off to `site/app.js` (the Phase 3 dashboard). |
| `site/manifest.json` | PWA manifest: install metadata, `any` + `maskable` icons. |
| `site/sw.js` | Service worker: precaches the app shell, stale-while-revalidate for same-origin requests (same pattern as `comepaolo-mealprep`'s `sw.js`). |
| `site/icons/` | App icon set generated from one 1024 source (`icon-source.jpeg`) via `sips`: `icon-master-full.png` (plain, edge-to-edge) feeds `icon-192/512`, `apple-touch-icon`, `favicon-16/32`; `icon-master.png` (mascot shrunk onto a solid `--accent`-filled square, for OS icon masks) feeds `icon-maskable-192/512`. Regenerate downstream sizes from the masters if the art changes. |
| `skill-addition/` | Section to add to the coach skill so it writes `SXX.json` week files to Drive. |

## Commands

```
npm test                                   # unit tests on synthetic data (runs in CI)
NOW=2026-09-26T12:00:00Z npm run build:data -- test/fixtures/local   # real-data fixture, gitignored
npm run dev                                # UI work: serves site/ + plaintext /data.json, no password
npm run all && npm run serve               # full local pipeline with real secrets in env
```

For local runs put secrets in `.env` (gitignored) and use `node --env-file=.env scripts/fetch.js`.

## Privacy rules (non-negotiable)

1. Nothing under `data/`, `test/fixtures/local/` or any real personal value is ever committed.
   Synthetic fixtures only in committed tests.
2. `dist/` must only contain site files and `data.enc.json`. The workflow has a guard step;
   keep it working when you change the build.
3. Never `console.log` workout, weight or note content in scripts: Action logs are public
   on a public repo. Counts only.
4. No analytics, no third-party requests at runtime except pinned CDN scripts (charts).
   The decrypted data never leaves the browser.

## Domain facts the UI must respect

These come from the coach skill. Getting them wrong makes the dashboard contradict the coach.

- **Weeks** run Sunday -> Saturday, except that a run logged on a Saturday counts as the next week's
  run (the athlete sometimes runs a day early; `workoutWeek` in `normalize.js`). Gym sessions and weight
  stay in the week their date falls in. Sunday run opens the week, gym Mon/Wed/Fri, Saturday is
  report day. Week 8 = deload, week 12 = taper: both look "too easy" by design. The UI must
  say so rather than rendering them as a drop in performance.
- **Block transitions** (weeks 4 and 9) jump loads 10-15% because the rep range drops. Mark
  them on every load chart so the jump is not read as progress.
- **Bodyweight**: Hevy stores one value per date. Weekly average only with >= 3 days
  (`avg: null` otherwise: show "not enough data", never interpolate). Show weekly
  averages prominently and daily dots faintly; the coach deliberately avoids inviting
  day-to-day reading. Target loss 0.5 kg/week, healthy band 0.3-0.7, halt above 0.9.
- **Dumbbells**: since 2026-09-12 logged as the sum of both dumbbells. Earlier sets were per
  hand and are doubled in `normalize.js` (`doubled: true` on the point). Show that marker.
- **Assisted pull-up**: `kg` is assistance. Lower is better: invert the chart or label it.
- **Priority muscles**: shoulders and chest. Lateral raise, shoulder press, reverse fly go first.
- **2x2 rule** progress comes from `coach.decisions[].twoByTwo`. If a week has no coach file,
  show nothing rather than guessing.
- **Pain**: `painFlag` / `coach.painFlags` must be visually unmissable on the affected week.
- **Routine loads in Hevy are not prescriptions.** Finishing a workout lets Hevy overwrite
  the routine with what was lifted. Never read targets from `/routines`: the prescription
  for week N is `coach(N).prescription` (= `coach(N-1).next`). Routines are fetched only
  for display/debugging.
- **Backfilled weeks** (`coach.mode === "backfill"`, weeks 1-2) were reconstructed by hand:
  `null` loads mean unknown, never zero. Show them as "—" and surface `backfillNotes`
  on the week page.
- **Per-set loads**: a prescription entry may carry `kgPerSet` (e.g. seated row
  50-50-45-45); `kg` is then the heaviest. Compare set by set when present.
- **Decision timing**: `coach(N).decisions` are made at the end of week N and apply to
  week N+1. On an exercise chart, show a decision after week N's points, not on them.
- **Mislogged week 1 entries** are remapped in `plan/template-ids.json`: S01 C "Lat
  Pulldown" was vertical traction, "Rear Delt Reverse Fly (Machine)" was dumbbells.

## data.json contract (produced by `buildData`)

```
generatedAt, hevyFetchedAt
cycle      { start, weeks, timezone, currentWeek, today, ... }
rules      progression text, increments, caps, weightLoss thresholds
exercises  plan key -> { name (IT), hevy[], kind, muscle?, priority?, dumbbell?, note? }
muscleGroups[]  ordered muscle names (priority first); `muscle` is one of them, absent for stretching/running
runningBaseline { beforeBreakMinutes, onReturnMinutes }
weeks[12]  { week, block, phase, volume, rir, reps, rest, transition?, immutable?, technique?,
             range{start,end}, state: done|current|future,
             planned (base plan per session A/B/C, or {rule} for weeks 8/12),
             plannedRpe (10 - RIR midpoint), plannedSets (working sets across A+B+C),
             setsByMuscle{planned{Muscle:n}, logged{Muscle:n}} (working sets, from plan / from Hevy),
             runTarget, runTargetMinutes|null, sessions{A,B,C: workoutId|null}, gymDone, extraWorkouts[],
             run{id,km,minutes,paceMinPerKm}|null, bodyweight{n,avg,delta,status}|null,
             feedback[{source,date,text,exercise?}] (source mixes two vocabularies:
             hevy-workout|hevy-exercise from Hevy notes, email|hevy from the coach file), painFlag,
             coach (SXX.json, written by the hevy-weekly-coach skill each Saturday) | null,
             report{name,date,week,verdict,markdown} | null, overridesActive[] }
workouts[] { id, title, date, week, kind: gym|run|other, session?, durationMin, description,
             painFlag, warning?, run?, exercises[{ key, hevyTitle, templateId, notes, doubledFromPerHand,
             sets[{type,kg,reps,seconds,meters,rpe}], summary{workingSets,topKg,minKg,reps[],
             volumeKg,bestE1rm,droppedWithinSession} }] }
series     plan key -> [{ date, week, session, workoutId, topKg, minKg, reps[], workingSets,
             bestE1rm, dropped, doubled, prescribed|null, progression|null }]
bodyweight { days[{date,kg,week}], weeks[{week,n,avg,delta,status}] }
runs[]     { date, week, id, km, minutes, paceMinPerKm }
routineNotes { week, A, B, C, run } | null   the coach's routine description from Hevy (Italian, verbatim);
           only valid for that `week` (Hevy rewrites routines weekly), any entry can be null
overrides[] { from|null, text, permanent }
reports[]  all coach reports incl. pre-cycle
quality    { unmappedExercises[], weeksMissingCoachData[], bodyweightDays }
```

Extend the contract freely, but update this section and add a test when you do.

## Phase 3: the dashboard UI (next task)

Replace the placeholder `render()` in `site/index.html`. Keep a single page, vanilla JS +
one charting library loaded from a pinned CDN (e.g. Chart.js UMD or uPlot), hash-based
routing (`#/`, `#/exercises/lateral_raise`, `#/week/5`). **The interface is in English only**
(athlete's choice). Content that stays Italian and is shown verbatim, never machine-translated:
the coach's report Markdown and the athlete's own notes and feedback quotes. Everything
else (labels, phases, exercise names from plan.json, the coach's `verdict` and `reason`
fields) is English. Mobile first: it will mostly be opened on a phone at the gym
or on Saturday evening after the report email.

Views, in priority order:

1. **Overview**: stat tiles (phase, this week n/4, weight, next up), the "Week N: Phase"
   section (training parameters plus a tile per session and the run, solid if logged, dashed
   and linking to its planned-session page if pending), and the 12-week strip: blocks, deload
   and taper marked, adherence per week (A/B/C/run), weekly weight average, pain flags.
   There is no separate "What's next" or "latest verdict" section (removed on purpose).
   **Effort &amp; volume (agreed with the athlete; shown on the Workouts page):** one dual-axis chart — bars for planned
   volume (working sets per week across A+B+C, left axis), a line for planned intensity
   (RIR midpoint converted to RPE, 10 = failure, right axis, 0-10 fixed), both across S1-S12:
   two facets of the same week's planned training stimulus, not unrelated metrics, so one
   chart is fine (see the dual-axis note below). Current week highlighted as a band labelled
   "you are here"; the RPE line is solid for past weeks, dashed for future ones. Deload and
   taper weeks dip on both series by design. Both series are derived from plan.json at build
   time: `weeks[].plannedRpe` and `weeks[].plannedSets` in data.json (week 8 = half of week
   7's sets, week 12 = 3 sets per block-3 exercise), covered by a test.
   **Dual-axis rule of thumb:** a combo chart with two y-axes is fine when both series
   describe the same thing (one week's training stimulus; one run's pace and distance — see
   Running below) — never when they're two genuinely unrelated metrics that just happen to
   share an x-axis. When mixing a bar and a line that could land at similar heights on their
   respective axes, give the bar's axis extra headroom (`suggestedMax` well above its real
   max) so the two series don't visually merge.
2. **Weight**: weekly averages vs the 0.5 kg/week target line with the 0.3-0.7 band shaded,
   daily values as faint dots, the coach's nutrition suggestion when present.
3. **Exercises**: a cycle-to-date chart on top (horizontal bars per muscle group: working
   sets logged vs still to do, from `weeks[].setsByMuscle` summed up to the current week),
   then one small card per exercise grouped by muscle (priority muscles and exercises first),
   showing the current load. No sparklines or unexplained pills on the cards.
   Detail page: load and reps per session vs prescription, e1RM trend, block-transition
   markers, doubled-from-per-hand markers, the coach's `reason` per week, and the 2x2 /
   held-for-N-weeks state as plain sentences. Both charts carry a dashed **estimate** to week 12
   (`projectLoads` in `site/lib/progression.js`: own weekly gain, ~12.5% at block changes, deload = week 7,
   taper -10%, only weeks where the exercise is in the program, never a drop); it is an estimate, not a
   prescription, and the coach's `next` load anchors its first point when there is one.
4. **Running**: pace (min/km) and distance (km) per week on one dual-axis chart — bars for
   pace (left axis), a line for distance (right axis), since both describe the same weekly
   run. A continuous dashed line marks the pre-break pace (60'/10km = 6.0'/km) across all 12
   weeks as the cycle-wide goal — not a per-week target invented for weeks the plan only
   describes in text (distance/effort), never a number. Stat tiles above the chart: latest
   pace, latest distance, pre-break pace, block-3 target (65'/10km = 6.5'/km, weeks 9-11,
   shown as a number only, not a chart line, since it doesn't apply to the other 9 weeks).
5. **Week N**: every session set by set against the prescription, the athlete's
   feedback, the coach's report rendered from Markdown, overrides active that week.
6. **Coach decisions**: a chronological log across weeks of `coach.decisions`: per
   exercise, raised / held / lowered / reset / transition / pain, from and to kg, the
   coach's reason, 2x2 progress. Filterable by exercise and by action. Also lists halts
   (`coach.halt`), nutrition suggestions and overrides applied, each with its week.
   Weeks with no coach file are shown as gaps, not hidden.
7. **Workouts**: a flat, newest-first log of every logged session (gym, run, other) straight
   from `workouts[]` — the raw Hevy record, independent of the prescription-vs-actual framing
   Week N gives the same sessions. Detail page: exercise-by-exercise sets and e1RM (gym), or
   distance/time/pace (run), plus a computed summary (volume, working sets, duration) — never
   an invented verdict, since there's no coach judgment at the single-session level.

Planned (not yet logged) sessions and the run are links too: `#/plan/:week/:A|B|C|run` shows the
session's prescription (coach loads, else the week rule, else the base plan) and the coach's routine note.
Nested pages (single exercise, workout/run, week) replace the tab bar with a back header: a back
arrow (browser history when the previous page is inside the app, else the parent list; the week
page always returns to Overview), a short title, and on workouts/runs a "Week N" button on the right.

Design: a training log, not a SaaS template. Numbers are the content: give weights and
dates a tabular-figure face, keep chrome minimal, one accent colour for "this week", a
calm palette for done/future. Respect `prefers-color-scheme` and reduced motion. Read the
frontend-design guidance before starting if available.

## Known open items

- Verify the Hevy body-measurements endpoint path and list key on the first real fetch
  (`scripts/lib/hevy.js`); the client already tolerates a different list key.
- Template ids: all exercises used in weeks 1-3 are mapped. Blocks 2-3 introduce new ones
  (bench, RDL, assisted pull-up, hammer curl, push up, dip…): `build:data` lists any
  unmapped id; add it to `plan/template-ids.json`.
- Drive `dati/` exists (created 2026-09-26) with backfilled `S01.json` and `S02.json`;
  set its id as the `DRIVE_DATA_FOLDER_ID` repo variable.
- Body measurements beyond weight are out of scope for now (athlete's choice). Hevy can
  store waist, chest, arms etc.; a "Measurements" view can be added later if he starts logging them.
- From week 3 on, the coach writes `SXX.json` itself every Saturday. If a week is
  missing after its Saturday, check the coach run before touching the dashboard.
