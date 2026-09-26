// Encryption shared by Node (build) and the browser (site/index.html duplicates decrypt()).
// Scheme: gzip(JSON) -> AES-256-GCM, key = PBKDF2-SHA256(passphrase, salt, ITERATIONS).
// Keep both sides in sync if you change anything here.

import { gzipSync } from 'node:zlib';

export const ITERATIONS = 600_000;
// Fixed per-repo salt (not secret). Keeping it stable means the derived key is stable across
// builds, so the site's "remember on this device" stays valid after each scheduled rebuild.
// The IV is still random per build. Rotate the salt only together with the passphrase.
export const SALT_B64 = 'r6cEIwHJzsmpoWR4i8YFFg==';
const { subtle } = globalThis.crypto;
const b64 = (buf) => Buffer.from(buf).toString('base64');

export async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(obj, passphrase) {
  if (!passphrase || passphrase.length < 12) throw new Error('DASHBOARD_PASSPHRASE must be at least 12 characters');
  const salt = Buffer.from(SALT_B64, 'base64');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plain = gzipSync(Buffer.from(JSON.stringify(obj)));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(ct) };
}

export async function decryptJson(envelope, passphrase) {
  const { gunzipSync } = await import('node:zlib');
  const salt = Buffer.from(envelope.salt, 'base64');
  const key = await deriveKey(passphrase, salt, envelope.iterations);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(envelope.iv, 'base64') }, key, Buffer.from(envelope.data, 'base64'));
  return JSON.parse(gunzipSync(Buffer.from(plain)).toString('utf8'));
}
