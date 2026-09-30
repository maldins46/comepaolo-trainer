import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cycleWeek, localDate, parseScheme, plannedSessions, normalizeBodyweight, buildData, parseOverrides, rirMidpoint, plannedRpeForWeek, plannedSetsForWeek, normalizeRoutineNotes } from '../scripts/lib/normalize.js';
import { encryptJson, decryptJson } from '../scripts/lib/crypto.js';

const plan = JSON.parse(readFileSync('plan/plan.json', 'utf8'));
const templateIds = JSON.parse(readFileSync('plan/template-ids.json', 'utf8'));

test('cycle weeks run Sunday to Saturday from cycle start', () => {
  assert.equal(cycleWeek('2026-09-06', plan.cycle.start), 1); // Sunday run opens week 1
  assert.equal(cycleWeek('2026-09-12', plan.cycle.start), 1); // Saturday closes it
  assert.equal(cycleWeek('2026-09-13', plan.cycle.start), 2);
  assert.equal(cycleWeek('2026-09-03', plan.cycle.start), 0); // pre-cycle
  assert.equal(cycleWeek('2026-11-28', plan.cycle.start), 12);
});

test('workout dates use Europe/Rome, not UTC', () => {
  // 23:30 UTC Saturday is already Sunday in Rome -> next week
  assert.equal(localDate('2026-09-12T22:30:00Z', 'Europe/Rome'), '2026-09-13');
});

test('set schemes parse', () => {
  assert.deepEqual(parseScheme('4x10'), { raw: '4x10', sets: 4, reps: 10, repsMax: undefined, perSide: false });
  assert.equal(parseScheme('3x12/side').perSide, true);
  assert.equal(parseScheme('4x8-10').repsMax, 10);
  assert.equal(parseScheme('3x40s').seconds, 40);
  assert.equal(parseScheme('3xmax').sets, undefined);
});

test('planned sessions pick the right week column', () => {
  const w3 = plannedSessions(plan, 3);
  assert.equal(w3.A[0].scheme.raw, '4x10'); // chest press W3
  assert.equal(w3.A[5].scheme.raw, '3x15'); // reverse fly, single scheme for all weeks
  assert.ok(plannedSessions(plan, 8).rule);  // deload is a rule
});

test('plannedRpe: RIR midpoint, including the mixed-text week 11 case', () => {
  assert.equal(rirMidpoint('3-4'), 3.5);
  assert.equal(rirMidpoint('3'), 3);
  assert.equal(rirMidpoint('0-1 last set'), 0.5); // strips trailing qualifier text
  assert.equal(plannedRpeForWeek(plan.weeks.find((w) => w.week === 1)), 6.5);
  assert.equal(plannedRpeForWeek(plan.weeks.find((w) => w.week === 8)), 5.5);
  assert.equal(plannedRpeForWeek(plan.weeks.find((w) => w.week === 11)), 9.5);
  assert.equal(plannedRpeForWeek(plan.weeks.find((w) => w.week === 12)), 7);
});

test('plannedSets: table-derived normal week, deload half of week 7, taper 3x block-3 exercises', () => {
  assert.equal(plannedSetsForWeek(plan, 3), 75);
  assert.equal(plannedSetsForWeek(plan, 7), 82);
  assert.equal(plannedSetsForWeek(plan, 8), 41); // round(82/2)
  assert.equal(plannedSetsForWeek(plan, 12), 57); // 19 block-3 exercises x 3
});

test('bodyweight: <3 days = no average; status bands', () => {
  const bw = normalizeBodyweight([
    { date: '2026-09-06', weight_kg: 81 }, { date: '2026-09-08', weight_kg: 81 }, { date: '2026-09-10', weight_kg: 81 },
    { date: '2026-09-13', weight_kg: 80.5 }, { date: '2026-09-15', weight_kg: 80.5 }, { date: '2026-09-17', weight_kg: 80.5 },
    { date: '2026-09-20', weight_kg: 80 }, { date: '2026-09-22', weight_kg: 80 },
  ], plan);
  assert.equal(bw.weeks[1].avg, 80.5);
  assert.equal(bw.weeks[1].delta, -0.5);
  assert.equal(bw.weeks[1].status, 'ok');
  assert.equal(bw.weeks[2].avg, null);
  assert.equal(bw.weeks[2].status, 'n/a');
});

test('overrides: dated vs permanent, header line skipped', () => {
  const o = parseOverrides({ text: 'Formato...\n\n2026-09-12 · Usa vertical traction\nSempre stretching' });
  assert.deepEqual(o, [
    { from: '2026-09-12', text: 'Usa vertical traction', permanent: false },
    { from: null, text: 'Sempre stretching', permanent: true },
  ]);
});

const synthetic = {
  fetchedAt: '2026-09-20T00:00:00Z',
  workouts: [
    { id: 'w1', title: 'S01 A — Test', start_time: '2026-09-07T04:30:00Z', end_time: '2026-09-07T05:20:00Z', description: 'Spalla ok',
      exercises: [{ title: 'Lateral Raise (Dumbbell)', exercise_template_id: '422B08F1', notes: '',
        sets: [{ type: 'warmup', weight_kg: 2, reps: 15 }, { type: 'normal', weight_kg: 4, reps: 15 }, { type: 'normal', weight_kg: 4, reps: 15 }] }] },
    { id: 'w2', title: 'S02 A — Test', start_time: '2026-09-14T04:30:00Z', end_time: '2026-09-14T05:20:00Z',
      exercises: [{ title: 'Lateral Raise (Dumbbell)', exercise_template_id: '422B08F1', notes: 'fitta alla spalla',
        sets: [{ type: 'normal', weight_kg: 8, reps: 15 }] }] },
    { id: 'r1', title: 'Domenica — Corsa', start_time: '2026-09-13T06:00:00Z', end_time: '2026-09-13T07:00:00Z',
      exercises: [{ title: 'Running', exercise_template_id: 'AC1BB830', sets: [{ type: 'normal', distance_meters: 8000, duration_seconds: 3000 }] }] },
    { id: 'x1', title: 'Mystery', start_time: '2026-09-15T04:30:00Z', end_time: '2026-09-15T05:00:00Z',
      exercises: [{ title: 'Something (Machine)', exercise_template_id: 'ZZZ', sets: [{ type: 'normal', weight_kg: 10, reps: 10 }] }] },
  ],
  bodyMeasurements: [],
};

test('buildData: dumbbell doubling, runs, weeks, pain flag, unmapped', () => {
  const d = buildData({ plan, templateIds, hevy: synthetic, drive: null, now: new Date('2026-09-16T10:00:00Z') });
  const lr = d.series.lateral_raise;
  assert.equal(lr[0].topKg, 8);        // 4 per hand in week 1 -> 8 total
  assert.equal(lr[0].doubled, true);
  assert.equal(lr[0].workingSets, 2);  // warmup excluded
  assert.equal(lr[1].topKg, 8);        // week 2 already logged as total
  assert.equal(d.cycle.currentWeek, 2);
  assert.equal(d.weeks[0].gymDone, 1);
  assert.equal(d.weeks[1].run.km, 8);
  assert.equal(d.weeks[1].run.paceMinPerKm, 6.25);
  assert.equal(d.weeks[1].painFlag, true);
  assert.equal(d.weeks[0].feedback[0].text, 'Spalla ok');
  assert.deepEqual(d.quality.unmappedExercises, ['ZZZ Something (Machine)']);
});

test('routine notes: per session + run, empty -> null, other titles ignored, none -> null', () => {
  const rn = normalizeRoutineNotes([
    { title: 'S04 A — Petto', notes: '  Blocco 2, settimana 4.  ' },
    { title: 'S04 B — Gambe', notes: '' },
    { title: 'S04 C — Schiena', description: 'Via description' },
    { title: 'Domenica — Corsa 10 km', notes: 'Progressivo' },
    { title: 'Gym day 1', notes: 'old template' },
  ]);
  assert.deepEqual(rn, { week: 4, A: 'Blocco 2, settimana 4.', B: null, C: 'Via description', run: 'Progressivo' });
  assert.equal(normalizeRoutineNotes([{ title: 'Gym day 1', notes: 'x' }]), null);
  assert.equal(normalizeRoutineNotes(undefined), null);
  const d = buildData({ plan, templateIds, hevy: { ...synthetic, routines: [{ title: 'S02 A — x', notes: 'n' }] }, drive: null, now: new Date('2026-09-16T10:00:00Z') });
  assert.equal(d.routineNotes.A, 'n');
  assert.equal(d.quality.routinesWithNotes, 1);
  assert.equal(buildData({ plan, templateIds, hevy: synthetic, drive: null, now: new Date('2026-09-16T10:00:00Z') }).routineNotes, null);
});

test('encryption round-trips and rejects a wrong passphrase', async () => {
  const env = await encryptJson({ hello: 'mondo' }, 'correct horse battery');
  assert.deepEqual(await decryptJson(env, 'correct horse battery'), { hello: 'mondo' });
  await assert.rejects(decryptJson(env, 'wrong passphrase!!'));
});
