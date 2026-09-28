// Local preview. `npm run serve` -> http://localhost:5173
// Serves dist/ (encrypted, like production). With --dev it serves site/ and exposes the
// plaintext data/data.json at /data.json so you can iterate on the UI without the password.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const dev = process.argv.includes('--dev');
const root = dev ? 'site' : 'dist';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = dev && path === '/data.json' ? 'data/data.json' : join(root, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(5173, () => console.log(`serving ${root}/ on http://localhost:5173${dev ? ' (dev: plaintext data at /data.json)' : ''}`));
