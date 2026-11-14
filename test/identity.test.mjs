/* The identity of the site, checked as data rather than trusted as prose.
 *
 * Everything here was a real defect at some point in this tree's history: a
 * page shipped without a skip link, a stylesheet nobody linked, a stale
 * wordmark in a social card, a bundle referenced by nothing. Each check reads
 * the files that actually ship.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler']);

function walk(dir, ext) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
}

const pages = walk(ROOT, '.html');
const rel = (p) => relative(ROOT, p).split('\\').join('/');

test('every shipped page has a skip link that points at a real landmark', () => {
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const link = html.match(/class="skip-link"[^>]*href="#([^"]+)"/);
    assert.ok(link, `${rel(page)} has no skip link`);
    // The target has to exist, or the link drops the reader at the top of the
    // document while pretending to skip the navigation.
    assert.match(html, new RegExp(`id="${link[1]}"`), `${rel(page)} skips to #${link[1]}, which is not there`);
  }
});

test('every page but the 404 declares a canonical address', () => {
  for (const page of pages) {
    if (rel(page) === '404.html') continue;
    const html = readFileSync(page, 'utf8');
    const tag = html.match(/<link\b[^>]*rel="canonical"[^>]*>/);
    assert.ok(tag, `${rel(page)} has no canonical`);
    assert.match(tag[0], /https:\/\/veridell\.pages\.dev\//, `${rel(page)} canonically points somewhere else`);
  }
});

test('every page but the 404 carries structured data', () => {
  for (const page of pages) {
    if (rel(page) === '404.html') continue;
    const html = readFileSync(page, 'utf8');
    assert.match(html, /application\/ld\+json/, `${rel(page)} has no JSON-LD`);
  }
});

test('no stylesheet ships that no page asks for', () => {
  const sheets = readdirSync(join(ROOT, 'assets/css')).filter((f) => f.endsWith('.css'));
  const bundles = sheets.filter((f) => f.startsWith('bundle-'));
  const linked = new Set();
  for (const page of pages) {
    for (const m of readFileSync(page, 'utf8').matchAll(/assets\/css\/([a-z0-9.-]+\.css)/g)) {
      linked.add(m[1]);
    }
  }
  for (const bundle of bundles) {
    assert.ok(linked.has(bundle), `bundle ${bundle} is referenced by no page`);
  }
});

test('the old product name is gone from everything that ships', () => {
  const gone = ['Encyclopaedia Mundi', 'encyclopaediamundi', 'EncyclopaediaMundi'];
  const shipped = [...pages, ...walk(ROOT, '.js'), ...walk(ROOT, '.css'),
    ...walk(ROOT, '.json'), ...walk(ROOT, '.webmanifest'), ...walk(ROOT, '.txt')]
    .filter((p) => !rel(p).startsWith('test/'));
  for (const file of shipped) {
    const body = readFileSync(file, 'utf8');
    for (const word of gone) {
      assert.ok(!body.includes(word), `${rel(file)} still says "${word}"`);
    }
  }
});

test('the mark exists at every size the manifest and the icons ask for', () => {
  const sizes = ['facet.svg', 'facet-48.png', 'facet-96.png', 'facet-180.png',
    'facet-192.png', 'facet-512.png', 'facet-maskable-512.png', 'og-card.png'];
  for (const name of sizes) {
    const file = join(ROOT, 'assets/img/brand', name);
    assert.ok(existsSync(file), `missing brand asset ${name}`);
    assert.ok(statSync(file).size > 200, `brand asset ${name} is suspiciously small`);
  }
  const svg = readFileSync(join(ROOT, 'assets/img/brand/facet.svg'), 'utf8');
  assert.match(svg, /<title>Veridell<\/title>/, 'the mark does not name the product');
});

test('the package and the deployment agree on one name', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'veridell');
  assert.equal(pkg.repository.url, 'https://github.com/galeoindus/veridell.git');
  assert.equal(pkg.homepage, 'https://veridell.pages.dev/');

  const wrangler = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8');
  assert.match(wrangler, /^name = "veridell"$/m, 'wrangler.toml names another project');

  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.match(manifest.name, /^Veridell/, 'the manifest names another product');
});

test('one version reaches the page and the package', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const stamped = home.match(/\?v=(\d+\.\d+\.\d+)/);
  assert.ok(stamped, 'index.html carries no build stamp');
  assert.equal(stamped[1], pkg.version, 'the page and the package disagree on the version');
});

test('the promise line is the same everywhere it is written', () => {
  const promise = 'Every answer, with its source';
  const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const config = readFileSync(join(ROOT, 'assets/js/config.js'), 'utf8');
  assert.ok(home.includes(promise), 'the home page does not carry the promise');
  assert.ok(config.includes(promise), 'config.js does not carry the promise');
});
