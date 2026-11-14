/* Every asset a page asks for has to exist, at a path the page can reach.
 *
 * This is the check that would have caught the unstyled page: an asset URL that
 * points at nothing returns a 404, the stylesheet never applies, and the site
 * looks broken while the HTML itself is fine.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function pages(dir = ROOT, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'tests', 'scripts', 'functions', 'data'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pages(full, found);
    else if (entry.name === 'index.html' || entry.name === '404.html') found.push(full);
  }
  return found;
}

const LOCAL = /^(?!https?:|mailto:|tel:|data:|javascript:|#)(.+)$/;

test('every local asset a page references exists on disk', () => {
  const missing = [];
  for (const file of pages()) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const raw = match[1].trim();
      const hit = LOCAL.exec(raw);
      if (!hit) continue;
      const path = raw.split('?')[0].split('#')[0];
      if (!path) continue;
      let target = path.startsWith('/') ? join(ROOT, path) : resolve(dirname(file), path);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      if (!existsSync(target)) missing.push(`${relative(ROOT, file)} → ${raw}`);
    }
  }
  assert.deepEqual(missing, [], `these references point at nothing:\n${missing.join('\n')}`);
});

test('every page loads a stylesheet, and that stylesheet is not empty', () => {
  for (const file of pages()) {
    const html = readFileSync(file, 'utf8');
    const href = /<link rel="stylesheet" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(href, `${relative(ROOT, file)} has no stylesheet`);
    const target = href.startsWith('/') ? join(ROOT, href) : resolve(dirname(file), href);
    assert.ok(existsSync(target), `${relative(ROOT, file)} → ${href} is missing`);
    assert.ok(readFileSync(target, 'utf8').length > 4000, `${href} looks empty`);
  }
});

test('no page uses a root-absolute asset path', () => {
  // "/styles/site.css" is correct only when the site is served from the root of
  // a host. Opened from a sub-folder or from disk it 404s, and the page arrives
  // unstyled — the failure this test exists to prevent.
  for (const file of pages()) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="(\/(?:styles|src|assets|manifest)[^"]*)"/g)) {
      assert.fail(`${relative(ROOT, file)} uses the absolute asset path ${match[1]}`);
    }
  }
});

test('the theme is decided before the first paint', () => {
  for (const file of ['index.html', 'chat/index.html', 'articles/Ashoka/index.html']) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    const boot = html.indexOf('theme-boot.js');
    const css = html.indexOf('rel="stylesheet"');
    assert.ok(boot > -1, `${file} has no theme bootstrap`);
    assert.ok(boot < css, `${file} sets the theme after the stylesheet`);
  }
});
