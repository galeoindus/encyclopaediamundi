#!/usr/bin/env node
/* Run one browser check against a temporary static server.
 *
 * The check scripts expect the site to already be served on :4173 and a
 * headless Chromium to be reachable on their debugging port. Nothing in this
 * sandbox can hold a server open between calls, so this starts one, waits for
 * it, runs the check, and shuts everything down — all in one foreground
 * process.
 *
 *   node scripts/run-browser-check.mjs site-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = process.argv[2];
if (!script) {
  console.error('usage: node scripts/run-browser-check.mjs <script.mjs>');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    let body;
    try {
      body = await readFile(file);
    } catch {
      // SPA-style fallback for a directory route without the file
      try {
        body = await readFile(join(ROOT, 'index.html'));
      } catch {
        res.writeHead(404).end('not found');
        return;
      }
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(500).end();
  }
});

await new Promise((r) => server.listen(4173, '127.0.0.1', r));
console.log('serving', ROOT, 'on http://127.0.0.1:4173');

const child = spawn(process.execPath, [join(ROOT, 'scripts', script)], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, BASE: 'http://127.0.0.1:4173' },
});

const code = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)));
server.close();
process.exit(code);
