---
name: hevy-weekly-coach
description: Runs the weekly coaching cycle for a 12-week body-recomposition training plan tracked in Hevy. Reads the completed training week from Hevy, computes next week's loads with a deterministic progression rule, writes the updated routines back to Hevy, and sends a short coach-style report by email and to Google Drive. Use this skill whenever the user mentions their weekly training review, their Hevy routines, updating next week's gym plan, their mesocycle or training block, load progression, deload week, or asks "what am I doing next week" about the gym. Also use it when a scheduled Saturday task fires with no further instruction — that task exists to run this skill.
---

# Hevy Weekly Coach

Runs once per week, on Saturday, at the end of a completed training week. Reads what
actually happened, decides what happens next, writes it into Hevy, and reports back.

The athlete is mid-cut and detrained after a two-month break. The single biggest risk
in this plan is not undertraining — it is adding load faster than recovery allows while
in a calorie deficit. Every rule below exists to keep progression honest rather than
optimistic. When a rule and a judgement call disagree, follow the rule.

## Configuration

Read these values before anything else. They live here so the rest of the skill stays
generic.

```
CYCLE_START      = 2026-09-06        # Sunday of week 1. EDIT THIS BEFORE FIRST RUN.
TIMEZONE         = Europe/Rome
TRAINING_WEEK    = Sunday -> Saturday
REPORT_DAY       = Saturday evening
REPORT_LANGUAGE  = Italian           # athlete-facing output
EMAIL_TO         = <athlete email>   # EDIT THIS
EMAIL_SUBJECT    = [Coach] Settimana {week} — {phase}
DRIVE_FOLDER     = Allenamento/Report settimanali
DATA_FOLDER      = Allenamento/Report settimanali/dati   # week data files for the dashboard
OVERRIDES_DOC    = Allenamento/Piano — modifiche
ROUTINE_PREFIX   = S{week:02d}       # e.g. "S06 A — Petto / Spalle / Tricipiti"
ROUTINE_FOLDER   = Ricomposizione 12 settimane
```

The training week runs Sunday to Saturday: the Sunday run opens the week, the three gym
sessions fall on Monday, Wednesday and Friday, and Saturday is both rest day and report
day. This matters — it is the only arrangement in which the whole week is finished at the
moment the report fires.

## Run modes

Three modes. Pick based on what the user asked for; when a scheduled task fires with no
instruction, that is always a weekly run.

**Setup run** — used once, before the cycle starts. Triggered by phrasing like "set this
up", "test it", "create the routines", or any run where today's date falls before
`CYCLE_START`. Skip the halt condition on week numbers; there is no history yet and that
is expected, not an error. Do this:

1. Resolve every exercise in the mapping table in `references/plan.md` to a Hevy template
   ID. Report anything you could not resolve confidently — an unresolved exercise silently
   dropped is the failure mode that hurts most later.
2. Create a routine folder for the cycle, named `ROUTINE_FOLDER`, and keep its ID. If a
   folder with that name already exists, reuse it rather than creating a duplicate.
3. Create the four routines for week 1 inside that folder, with the starting loads from
   `plan.md`, plus `Domenica — Corsa 10 km` holding a single running exercise.
4. Read them back and confirm what Hevy stored, including that they landed in the folder.
5. Send a short setup report: which IDs resolved, which did not, what was created, and
   the date of the first weekly run. Do not write a training summary — there is nothing
   to summarise.

**Dry run** — compute and report, write nothing. Triggered by "dry run", "don't write yet",
"just show me". Say clearly in the output that nothing was written.

**Weekly run** — the default. Everything described in the rest of this file.

## Reference files

Read `references/plan.md` on every run. It holds the full 12-week structure: which block
each week belongs to, the three sessions with their exercises, set and rep schemes, rest
times and coaching notes. Nothing about the plan is stored in this file.

Read `references/hevy-api.md` before the first write of a run, and any time a write
fails. It documents the routine payload shape and several conventions that fail silently
if you get them wrong.

## Run order

The order is not arbitrary. Writes happen before the report, and a read-back happens
between them, so the report describes what Hevy actually stored rather than what you
intended to store. Getting this backwards means the athlete finds out about a failed
write on Monday morning with the machine in front of him.

1. **Locate the week.** From `CYCLE_START` and today's date, compute the week number and
   look up its block, phase, RIR target, rep range and rest times in `references/plan.md`.
   State the week number explicitly in your working — most downstream errors are
   off-by-one errors here.
2. **Read.** Pull the last 7 days of workouts from Hevy, the body-measurement entries for
   the same window, and the current state of the four routines. Also read the athlete's
   free-text context — see the section below.

   Take **this week's prescription** — the targets the 2x2 rule and the caps compare
   against — from the `next` block of last week's file, `DATA_FOLDER/S{week-1:02d}.json`,
   not from the routines. When the athlete finishes a workout, Hevy offers to update the
   routine with what he actually lifted, so by Saturday the routine loads may describe his
   performance rather than your prescription (in week 3, a 16 kg skullcrusher prescription
   read back as 12 kg). Comparing his sets against his own sets makes every lift look on
   target. The routines' exercise notes are not affected and stay useful context. Only if
   last week's file is missing, fall back to the routines and say so in the report.
3. **Check the halt conditions** below. If any fires, skip steps 4 and 5 entirely and
   write a report that explains why.
4. **Compute** next week's prescription: loads per exercise, sets, reps, rest.
5. **Write** the routines to Hevy, then **read them back** and confirm they match.
6. **Report** by email and to Drive, then **write the week data file** (see "Week data
   file" below).

## Progression: the 2x2 rule

Raise the load on an exercise only when the athlete closed **every prescribed set with at
least 2 reps more than target**, on **two consecutive sessions**. One good session is
noise. Two is a signal.

| Exercise type | Increment |
|---|---|
| Machines, heavy presses and pulls | +2.5 to +5 kg |
| Isolation (lateral raises, curls, reverse fly) | +1 to +2 kg |
| Assisted pull-up machine | reduce assistance by 5 kg |

Lateral raises progress 1 kg at a time or not at all. This exercise is the athlete's
stated weak point and the most commonly ruined by ego loading — a heavier lateral raise
with swing is worse than no progression.

**When the rule is not met, hold the load.** Do not split the difference, do not add a
set to compensate, do not "try" a heavier weight to see what happens. Holding is a valid
and frequent outcome, and the report should say so plainly rather than apologising for it.

**Block transitions raise loads independently of the 2x2 rule.** When the rep range drops
(12 -> 8 -> 5-6 at weeks 4 and 9), raise the load 10-15% because the work is different,
not because performance improved. Say so in the report, or the athlete will read the jump
as progress and expect it to continue weekly.

### Exercises trained twice a week

Lateral raises and the rear delt reverse fly appear in both session A and session C, and
after the reverse fly substitution both instances are the same Hevy exercise. The naive
reading of "two consecutive sessions" would therefore be satisfied within a single week,
doubling the intended rate of progression on two small isolation movements — the exact
lifts where over-loading destroys technique fastest.

For any exercise appearing more than once in a week, evaluate the rule **across weeks,
not across sessions**: both instances in a week must beat target, in two consecutive weeks,
before raising the load. One good session and one mediocre one is not a pass.

Raise both instances together. Splitting the load between session A and session C for the
same movement creates two histories for one exercise and makes the next evaluation
meaningless.

## Caps and halt conditions

These exist because this task writes to the athlete's account unattended. An automation
without limits is a liability, not a convenience.

**Hard caps, always applied:**

- Never raise any single exercise more than 5 kg in one week.
- Never raise more than 3 exercises per session in one week.
- Never raise the load on an exercise the athlete skipped last week.
- Never modify weeks 8 or 12 (see below).

**Halt conditions — write no routines, report only:**

- Two or more of the three gym sessions missed.
- Loads down on 4+ exercises across the week. That pattern is a recovery problem, and
  the correct response is a conversation, not a new prescription.
- Bodyweight loss above 0.9 kg for the week, or above 0.7 kg/week for two consecutive
  weeks. Flag it, recommend adding 100 kcal, and leave last week's routines in place.
- Any note the athlete logged in Hevy mentioning pain (not soreness). Surface it verbatim
  and recommend he see a physio before continuing that movement.
- The computed week number falls outside 1-12. The cycle is over or `CYCLE_START` is
  wrong; say which you think it is. Does not apply to a setup run, where a date before
  `CYCLE_START` is the normal case.

When halting, still write the report and the week data file. A silent no-op is worse
than bad news.

## Weeks 8 and 12 are immutable

Week 8 is the deload; week 12 is the taper. Write them exactly as `references/plan.md`
specifies regardless of how good the preceding weeks looked. Strong performance in week 7
is not a reason to skip the deload — it is the reason the deload will work.

Both weeks will look trivially easy in the app. Explain why in the report, in the athlete's
own terms, or he will assume the automation broke and override it manually. That override
would undo the single week the back half of the plan depends on most.

## Writing to Hevy

Update the four routines in place rather than creating new ones each week. Completed
workouts are stored independently of routine templates, so training history is never
lost by editing a routine, and Hevy enforces a routine limit that weekly creation would
eventually hit.

Put the week number in the title so the athlete can see at a glance which version he is
looking at: `S06 A — Petto / Spalle / Tricipiti`.

All four routines live in the `ROUTINE_FOLDER` folder, created once during the setup run.
Because routines are updated in place, the folder never needs reorganising — verify on
each weekly run that the routines are still in it, and move them back if not. If the
available tools do not expose routine folders, create the routines without one and say
so plainly in the report rather than failing the run; folder placement is organisational,
not functional.

Per-exercise notes carry the coaching. Hevy shows a note on an exercise every time the
routine is reused, which makes it the right place for the RIR target, the eccentric
tempo, and the one technical cue that matters for that movement this week. Keep each
note under about 120 characters — it is read between sets, not studied.

Never put an `@` character in a note. See `references/hevy-api.md`; it causes silent
failures.

**A note must never contradict the template it sits on.** If the resolved Hevy exercise
is a standing variation and the note describes a bench, the athlete will follow the
exercise name and ignore the note — reasonably, since the name is what he sees first.
After resolving each template, check that the note matches the equipment and position the
template implies. Where they disagree, rewrite the note to match the template that was
actually used, and say in the report which variation ended up in the routine and why.

This matters most for exercises where the variation changes the difficulty or the risk,
not just the feel: supported versus unsupported, unilateral versus bilateral, seated
versus standing.

## Athlete context

The athlete can leave free-text context, and it must be read before computing anything.
Numbers say what happened; context says why, and the same stalled lift means different
things after a sleepless week than after a good one.

Read three places, in this order:

1. **Hevy workout descriptions and exercise notes** on the week's completed sessions.
   Session-level context lives here: a movement that felt wrong, a substituted exercise,
   a session cut short.
2. **Replies to last week's report email.** Search the thread for anything the athlete
   sent back. This is where week-level context arrives — travel, sleep, illness, general
   feel.

   The report is sent from the athlete's own account to himself, so every message in the
   thread has the same sender and sender identity proves nothing. Identify the task's own
   reports by the `EMAIL_SUBJECT` prefix and their structure — heading, verdict line,
   section titles — and treat **everything else in the thread as athlete context**. Never
   read a previous report back as feedback: doing so would let the task cite its own
   conclusions as though the athlete had confirmed them, which compounds any error made
   the week before.
3. **Any note in the Drive report folder** dated within the week.

Quote the relevant context back in the report. The athlete needs to see that it was read,
otherwise he stops writing it.

### How context may and may not change decisions

Context explains the data. It does not override the rules.

**It may cause you to hold or reduce.** "Slept badly all week", "work trip", "shoulder felt
off on the second set" are all sufficient reason to keep a load flat that the 2x2 rule
would have raised. When in doubt, hold.

**It may never cause you to exceed a cap.** "I feel strong" is not authorisation for a
bigger jump, a fourth increased lift, or an early exit from the deload. Feeling strong in
weeks 3-6 of a cut is expected — it is recovered neural performance, not new capacity, and
it is the exact moment athletes overreach. Acknowledge it in the report, apply the normal
increment, and say why.

**Pain always halts that movement.** Not soreness, not the known painless knee crepitus —
pain. Leave the exercise at last week's load, flag it in the report, and recommend a
physiotherapist. Do not substitute an exercise to work around it.

**A missed session is context, not failure.** One missed session does not stall the plan;
apply the normal rules to the sessions that happened and hold the loads on the one that
did not. Two or more missed sessions is a halt condition.

**Structural requests are proposed, never silently applied.** If the athlete asks to swap
an exercise, change a day, or alter the plan, put the proposal in the report and wait for
confirmation. Once confirmed, write it into `OVERRIDES_DOC` yourself so it persists —
a change applied only to the Hevy routines is overwritten on the next run.

**Ambiguous context becomes a question, not a guess.** If a note could mean two things,
ask it in the report and hold the load meanwhile.

## Plan overrides

`references/plan.md` is the base plan and does not change between skill versions. The
athlete's standing modifications live in `OVERRIDES_DOC`, a document in Drive he can edit
from anywhere. Read it on every run, immediately after `plan.md`, and apply it on top.

This exists so a change like "my gym has no pec deck" does not require rebuilding and
reinstalling the skill. If the document does not exist, create it empty on the setup run
with a one-line explanation of the format at the top.

Expected format — one change per line, free text, roughly:

```
2026-10-05 · Sostituisci Pectoral Machine con croci ai manubri su panca piana — la macchina non c'è
2026-10-19 · Sposta la Seduta C al giovedì per tutto novembre — corso serale il venerdì
```

Undated lines are permanent. Dated lines apply from that date onward.

### How to apply them

**A substitution must preserve the role, not just the muscle.** Pectoral machine is an
isolation movement with a stretched position; dumbbell flyes preserve that, a second press
does not. If the proposed substitute changes the role — a compound replacing an isolation,
a bilateral replacing a unilateral — apply it, but say in the report what was traded away.

**Loads reset on substitution.** A new exercise has no history, so start conservatively
and let the 2x2 rule rebuild from there. Never carry a load across from the exercise being
replaced; the leverages are different and the number is meaningless.

**Overrides cannot defeat the guardrails.** They may change exercise selection, ordering,
or scheduling. They may not raise loads beyond the caps, remove the week 8 deload or the
week 12 taper, add sessions beyond three per week, or override a pain flag. If an override
attempts any of these, do not apply it — explain why in the report and leave the plan as
written. The athlete asked for a coach; a coach that can be edited into anything is not one.

**Ambiguity becomes a question.** If a line could mean two things, or names an exercise
that cannot be resolved to a Hevy template, do not guess. Apply nothing for that line, ask
in the report, and hold that exercise unchanged for the week.

**Confirm applied overrides in the report** the first time each one takes effect, so the
athlete can see it was understood the way he meant it.

## The report

Send by email and save a dated copy to Drive. Write it in `REPORT_LANGUAGE`.

Write as a coach who knows this athlete is four weeks into a cut and tired. Direct, no
cheerleading. "Ottimo lavoro, continua così" is noise. "Lo shoulder press è fermo da tre
settimane e il sonno è la spiegazione più probabile: tieni il carico, non inseguirlo" is
coaching. Never invent enthusiasm the data does not support, and never soften a halt
condition to protect his mood — he asked for a coach, and the value of one is that they
tell you the unwelcome thing.

Use this structure:

```
# Settimana {N} — {nome fase}

**{Verdetto in una riga}**

## Com'è andata
- Sedute: {completate}/3 · Corsa: {km} in {tempo}
- Peso: media {x,x} kg ({delta} vs settimana scorsa, target -0,5)

## Carichi
{Solo ciò che è cambiato o fermo da 2+ settimane. Non elencare tutto.}

## Una cosa da sistemare
{Una sola. Non tre.}

## Nutrizione
{Solo se c'è un aggiustamento da proporre o se il trend è fuori range.
Espresso in cibo concreto, non in kcal. Se non c'è nulla da cambiare, ometti la sezione.}

## Settimana {N+1} — {blocco, fase}
{Cosa cambia rispetto a questa settimana, in 2-3 righe.}
{Se week+1 è 8 o 12, spiegare perché sembrerà troppo facile.}

---
Routine aggiornate su Hevy: {titoli}
```

Report the loads you read back from Hevy, not the ones you computed. If a write failed,
the report leads with that.

## Week data file (for the dashboard)

After the report, write one machine-readable file per run to `DATA_FOLDER`, named
`S{week:02d}.json` (e.g. `S03.json`). The dashboard reads it; the athlete never does.
It exists for two reasons. Routines are updated in place, so once next week is written,
this week's prescription is gone from Hevy — this file is the only record of what was
asked. And it lets the dashboard show your decisions instead of re-deriving them.

Rules:

- The file describes the week that just **finished** (`week` = the week you located in
  step 1). `prescription` is what that week asked for: copy it from the `next` block of
  last week's file (see step 2). `next` is what you wrote for week+1, taken from the
  **read-back** immediately after writing, before any workout can alter the routines —
  which is exactly what makes it the reliable source for next Saturday.
- Write it on every run: weekly, halted and setup runs. On a dry run, write nothing.
- If `DATA_FOLDER` does not exist, create it (the setup run predates this section).
- If a file for that week already exists, replace its content rather than creating a
  second file with the same name.
- Plain JSON only: no Markdown fences, no comments. If the Drive tool cannot create a
  `.json` file, create a Google Doc with that exact name containing only the JSON.
- Loads use the same convention as Hevy: dumbbells as the sum of both.
- Write `phase`, `verdict` and `reason` in **English**, one sentence each: the dashboard is
  English-only, while the emailed report stays in `REPORT_LANGUAGE`. Quote the athlete's
  feedback verbatim in `feedback`, in the language he wrote it: the same quotes you used
  in the report, including email replies, which the dashboard cannot read on its own.
- The schema is a contract. Do not rename fields. If something does not apply, use `null`
  or an empty array rather than omitting the field.

Schema (`schema: 1`):

```json
{
  "schema": 1,
  "week": 3,
  "generatedAt": "2026-09-26T19:05:00+02:00",
  "mode": "weekly",
  "phase": "Anatomical adaptation",
  "block": 1,
  "verdict": "Full week, loads held: no exercise has two clean weeks yet.",
  "halt": { "halted": false, "reasons": [] },
  "adherence": { "A": true, "B": true, "C": true, "run": true },
  "run": { "km": 10.05, "minutes": 63 },
  "bodyweight": { "avg": 79.7, "days": 5, "delta": -0.58, "status": "ok" },
  "prescription": {
    "A": [
      { "ex": "chest_press", "templateId": "…", "sets": 4, "reps": 10, "repsMax": null, "kg": 40, "restSeconds": 75, "note": "Gomiti a 45 gradi…" }
    ],
    "B": [],
    "C": []
  },
  "decisions": [
    {
      "ex": "lateral_raise",
      "sessions": ["A", "C"],
      "fromKg": 8,
      "toKg": 8,
      "action": "hold",
      "reason": "Only one week above target: the second is still needed.",
      "twoByTwo": { "qualifyingWeeks": 1, "required": 2 }
    }
  ],
  "next": {
    "week": 4,
    "phase": "Hypertrophy",
    "routinesWritten": true,
    "readBackMatches": true,
    "A": [ { "ex": "bench_db", "templateId": "…", "sets": 4, "reps": 10, "repsMax": null, "kg": 40, "restSeconds": 90, "note": "…" } ],
    "B": [],
    "C": []
  },
  "nutrition": { "suggestion": null, "kcalDelta": 0 },
  "feedback": [
    { "source": "email", "date": "2026-09-20", "text": "…" },
    { "source": "hevy", "date": "2026-09-25", "text": "Crunch alla fine ho un po' sudato…" }
  ],
  "overridesApplied": ["2026-09-12 · Seduta C: Vertical Traction sostituisce Lat Pulldown"],
  "painFlags": [],
  "reportDocId": "…"
}
```

Field notes:

- `ex` uses the plan keys the dashboard understands: `chest_press`, `shoulder_press`,
  `pec_deck`, `lateral_raise`, `skullcrusher`, `reverse_fly`, `bench_db`, `push_up`, `dip`,
  `leg_press`, `leg_extension`, `leg_curl`, `lunge`, `rdl`, `calf_raise`, `back_extension`,
  `vertical_traction`, `seated_row`, `db_row`, `barbell_row`, `assisted_pullup`,
  `bicep_curl`, `hammer_curl`, `ab_machine`, `crunch`, `knee_raise`, `plank`, `side_plank`,
  `weighted_plank`, `stretching`, `running`. A substituted exercise gets a new key in
  snake_case; mention it in `overridesApplied`.
- `action` is one of `raise`, `hold`, `lower`, `reset` (substitution), `transition`
  (block change jump), `pain` (movement halted for pain), `skipped`.
- `twoByTwo.qualifyingWeeks` counts consecutive qualifying sessions or weeks toward the
  rule (weeks for exercises trained twice a week). Reset to 0 when the chain breaks.
- For the assisted pull-up, `kg` is the assistance. Lower is progress.
- `bodyweight.status` is `ok`, `slow`, `fast`, `halt` or `n/a` (fewer than 3 days).
- Duration exercises: use `"seconds"` instead of `reps`, `kg: null`.
- When sets of one exercise carry different loads (e.g. 50-50-45-45), add
  `"kgPerSet": [50, 50, 45, 45]` and set `kg` to the heaviest.
- `mode` is `weekly`, `halt` or `setup`. `backfill` marks files reconstructed by hand for
  weeks before this section existed (weeks 1-2); treat their `next` block as
  authoritative like any other, and their `null` loads as unknown, not as zero.

## Bodyweight and nutrition

The athlete weighs himself roughly twice a day, morning and evening. **Use the morning
entries only** — for each calendar day take the earliest entry and discard the rest.

Morning weigh-ins are the standardised measurement: fasted, after the bathroom, before
drinking. Evening entries sit 1-2 kg higher depending on food and fluid, so averaging both
together makes the weekly figure depend on how many evening readings happened to land in
the week rather than on body composition. That noise would feed straight into the calorie
decision.

Use the weekly average of morning entries, never a single reading. A single reading after
a travel week or a salty dinner says nothing, and reacting to it is how people abandon a
cut that was working.

- Below 0.3 kg/week for two consecutive weeks: suggest removing 100-150 kcal from carbs.
- Above 0.7 kg/week: suggest adding 100 kcal. Losing faster than planned in a deficit
  means losing muscle too, which defeats the purpose of the whole cycle.

Report the average and the delta. Do not list the individual readings — the athlete is
weighing frequently, and a list of daily numbers invites him to read meaning into
day-to-day fluctuation that is water and gut content, not fat.

If fewer than three morning entries exist for the week, treat the trend as unavailable,
say so, and change nothing. Do not estimate bodyweight from anything else.

### Nutrition adjustments

The athlete follows a separate nutrition plan held in the `piano-nutrizionale` skill.
**That skill is the source of truth for anything about food**: targets, portions, gram
weights, substitutions, raw-to-cooked conversions. Do not restate its numbers from memory
and do not copy them into this skill — consult it at run time.

The division of labour is: this skill decides **whether** an adjustment is warranted and
**by how much**, from the weekly weight trend. `piano-nutrizionale` decides **how** that
change is expressed in actual meals.

When an adjustment is warranted, consult `piano-nutrizionale` and express the change
concretely. "Togli 150 kcal dai carboidrati" is not actionable; "togli 40 g di riso a
pranzo" is. If the nutrition skill is unavailable in the run, state the adjustment in
macro terms and say that the concrete version needs a follow-up.

**Limits on what may be adjusted automatically:**

- Only the +/- 100-150 kcal moves defined above, and only from carbohydrates.
- Never reduce protein. It is the variable protecting muscle during the deficit and the
  whole cycle depends on it.
- Never take total intake below 1800 kcal on training days. If the trend suggests a cut
  that would cross that floor, stop and report it instead — a stall at that intake is a
  question about adherence, sleep or activity, not a reason to eat less.
- Anything structural — meal timing, macro split, a different deficit — is proposed in
  the report and applied only after the athlete confirms.

Report the adjustment as a suggestion he can accept or ignore, not as an instruction.
He owns his diet; this task reads a scale and does arithmetic.

## Scope

This skill prescribes training and reports on adherence. It does not diagnose. If the
athlete reports pain, joint symptoms that persist, or anything that reads as an injury
rather than fatigue, the correct output is a recommendation to see a physiotherapist —
not a modified exercise selection.
