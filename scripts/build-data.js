// Step 2: data/raw/* + plan/* -> data/data.json (plaintext, gitignored).
// Usage: node scripts/build-data.js [rawDir]   (rawDir defaults to data/raw; tests pass test/fixtures)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { buildData } from './lib/normalize.js';

const rawDir = process.argv[2] ?? 'data/raw';
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));

const data = buildData({
  plan: await read('plan/plan.json'),
  templateIds: await read('plan/template-ids.json'),
  hevy: await read(`${rawDir}/hevy.json`),
  drive: await read(`${rawDir}/drive.json`).catch(() => null),
  now: process.env.NOW ? new Date(process.env.NOW) : new Date(),
});

await mkdir('data', { recursive: true });
await writeFile('data/data.json', JSON.stringify(data, null, 2));
const q = data.quality;
console.log(`data.json: week ${data.cycle.currentWeek}/12, ${data.workouts.length} workouts, ${Object.keys(data.series).length} exercises`);
if (q.unmappedExercises.length) console.warn('unmapped exercises (add to plan/template-ids.json):\n  ' + q.unmappedExercises.join('\n  '));
if (q.weeksMissingCoachData.length) console.warn(`weeks without coach JSON: ${q.weeksMissingCoachData.join(', ')}`);
