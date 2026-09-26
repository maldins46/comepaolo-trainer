// Step 3: data/data.json -> dist/ (site files + data.enc.json). Only dist/ is ever published.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { encryptJson } from './lib/crypto.js';

const pass = process.env.DASHBOARD_PASSPHRASE;
if (!pass) { console.error('Missing DASHBOARD_PASSPHRASE'); process.exit(1); }

const data = JSON.parse(await readFile('data/data.json', 'utf8'));
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('site', 'dist', { recursive: true });
const env = await encryptJson(data, pass);
await writeFile('dist/data.enc.json', JSON.stringify(env));
await writeFile('dist/.nojekyll', '');
console.log(`dist/data.enc.json: ${(env.data.length / 1024).toFixed(0)} KB encrypted`);
