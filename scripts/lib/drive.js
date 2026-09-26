// Google Drive read-only client using a service account. Zero dependencies.
// Share the Drive folders (Report settimanali, dati) and the overrides doc with the
// service account's email as Viewer — that is the only access it has.

import { createSign } from 'node:crypto';

const API = 'https://www.googleapis.com/drive/v3';

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function getAccessToken(serviceAccountJson) {
  const sa = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat, exp: iat + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google token -> ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(url, token) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive ${url} -> ${res.status} ${await res.text()}`);
  return res;
}

export async function listFolder(folderId, token) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,createdTime,modifiedTime)');
  const res = await api(`${API}/files?q=${q}&fields=${fields}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`, token);
  return (await res.json()).files ?? [];
}

// Google Docs are exported as plain text; anything else is downloaded as-is.
export async function readText(file, token) {
  const url = file.mimeType === 'application/vnd.google-apps.document'
    ? `${API}/files/${file.id}/export?mimeType=text/plain`
    : `${API}/files/${file.id}?alt=media&supportsAllDrives=true`;
  return (await api(url, token)).text();
}

export async function getFile(fileId, token) {
  const res = await api(`${API}/files/${fileId}?fields=id,name,mimeType,modifiedTime&supportsAllDrives=true`, token);
  return res.json();
}

export async function fetchDrive(serviceAccountJson, { reportsFolderId, dataFolderId, overridesDocId }) {
  const token = await getAccessToken(serviceAccountJson);
  const out = { reports: [], weekData: [], overrides: null };

  if (reportsFolderId) {
    for (const f of await listFolder(reportsFolderId, token)) {
      if (f.mimeType === 'application/vnd.google-apps.folder') continue;
      out.reports.push({ ...f, text: await readText(f, token) });
    }
  }
  if (dataFolderId) {
    for (const f of await listFolder(dataFolderId, token)) {
      if (!/^S\d{2}(\.json)?$/i.test(f.name)) continue;
      out.weekData.push({ ...f, text: await readText(f, token) });
    }
  }
  if (overridesDocId) {
    const f = await getFile(overridesDocId, token);
    out.overrides = { ...f, text: await readText(f, token) };
  }
  return out;
}
