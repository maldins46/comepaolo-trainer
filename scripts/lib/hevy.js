// Minimal Hevy API client. Zero dependencies (Node 20+ global fetch).
// Docs: https://api.hevyapp.com/docs  — requires Hevy PRO, key from hevy.com/settings?developer

const BASE = 'https://api.hevyapp.com/v1';

async function get(path, apiKey) {
  const res = await fetch(BASE + path, { headers: { 'api-key': apiKey, accept: 'application/json' } });
  if (res.status === 404) return null; // Hevy returns 404 past the last page
  if (!res.ok) throw new Error(`Hevy ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

// Hevy list endpoints return { page, page_count, <listKey>: [...] }.
// listKey is detected as the first array-valued property so a renamed key doesn't break us.
async function fetchAll(path, apiKey, { pageSize = 10, maxPages = 200 } = {}) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const data = await get(`${path}${sep}page=${page}&pageSize=${pageSize}`, apiKey);
    if (!data) break;
    const list = Object.values(data).find(Array.isArray) ?? [];
    out.push(...list);
    if (list.length === 0 || page >= (data.page_count ?? page)) break;
  }
  return out;
}

export async function fetchHevy(apiKey, { since } = {}) {
  const [workouts, bodyMeasurements, routines, routineFolders] = await Promise.all([
    fetchAll('/workouts', apiKey),
    // VERIFY ON FIRST RUN: endpoint name for weigh-ins. The Hevy MCP exposes them, so an endpoint exists.
    fetchAll('/body_measurements', apiKey).catch((e) => { console.warn('body measurements:', e.message); return []; }),
    fetchAll('/routines', apiKey),
    fetchAll('/routine_folders', apiKey).catch(() => []),
  ]);
  const keep = (w) => !since || w.start_time >= since;
  return {
    fetchedAt: new Date().toISOString(),
    workouts: workouts.filter(keep),
    bodyMeasurements: bodyMeasurements.filter((m) => !since || m.date >= since.slice(0, 10)),
    routines,
    routineFolders,
  };
}
