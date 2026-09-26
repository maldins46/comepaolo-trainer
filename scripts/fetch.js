// Step 1: download everything to data/raw/ (gitignored). Reads secrets from env.
//   HEVY_API_KEY                 required
//   GOOGLE_SERVICE_ACCOUNT_JSON  optional (skip Drive if absent)
//   DRIVE_REPORTS_FOLDER_ID, DRIVE_DATA_FOLDER_ID, DRIVE_OVERRIDES_DOC_ID
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fetchHevy } from './lib/hevy.js';
import { fetchDrive } from './lib/drive.js';

const plan = JSON.parse(await readFile('plan/plan.json', 'utf8'));
const env = process.env;
if (!env.HEVY_API_KEY) { console.error('Missing HEVY_API_KEY'); process.exit(1); }

// Keep two weeks before the cycle for context ("Gym day 1/2" etc.)
const since = new Date(Date.parse(plan.cycle.start) - 14 * 86_400_000).toISOString();

await mkdir('data/raw', { recursive: true });

const hevy = await fetchHevy(env.HEVY_API_KEY, { since });
await writeFile('data/raw/hevy.json', JSON.stringify(hevy, null, 2));
console.log(`hevy: ${hevy.workouts.length} workouts, ${hevy.bodyMeasurements.length} weigh-ins, ${hevy.routines.length} routines`);

if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  const drive = await fetchDrive(env.GOOGLE_SERVICE_ACCOUNT_JSON, {
    reportsFolderId: env.DRIVE_REPORTS_FOLDER_ID,
    dataFolderId: env.DRIVE_DATA_FOLDER_ID,
    overridesDocId: env.DRIVE_OVERRIDES_DOC_ID,
  });
  await writeFile('data/raw/drive.json', JSON.stringify(drive, null, 2));
  console.log(`drive: ${drive.reports.length} reports, ${drive.weekData.length} week files, overrides ${drive.overrides ? 'yes' : 'no'}`);
} else {
  console.warn('drive: GOOGLE_SERVICE_ACCOUNT_JSON not set, skipping reports/overrides/week data');
  await writeFile('data/raw/drive.json', JSON.stringify({ reports: [], weekData: [], overrides: null }));
}
