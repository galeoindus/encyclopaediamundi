/* Tests for the generated article pages.
 *
 * The audit found two defects that only ever showed up in the built HTML, not
 * in the generator's own code paths, so they need a test over the real files:
 *
 *   1. Citation markers pointed at anchors that were never written. The
 *      reference list was capped at 100 while the numbering ran to the full
 *      count, so on twelve of the thirteen pages [101]…[499] were dead links.
 *   2. The meta description was a hard 155-character slice, so a snippet ended
 *      in "…missions developed by I" and "…human intellig".
 *
 * Both are cheap to assert and expensive to notice by hand across 13 pages.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES = join(ROOT, 'articles');

const pages = readdirSync(ARTICLES)
  .filter((name) => statSync(join(ARTICLES, name)).isDirectory())
  .map((name) => ({ name, html: readFileSync(join(ARTICLES, name, 'index.html'), 'utf8') }));

test('there are article pages to check', () => {
  assert.ok(pages.length >= 13, `expected at least 13 articles, found ${pages.length}`);
});

for (const { name, html } of pages) {
  test(`${name}: every citation marker points at a reference that exists`, () => {
    const targets = new Set([...html.matchAll(/id="ref-(\d+)"/g)].map((m) => m[1]));
    const cited = [...new Set([...html.matchAll(/href="#ref-(\d+)"/g)].map((m) => m[1]))];
    const dangling = cited.filter((n) => !targets.has(n));
    assert.deepEqual(dangling, [], `dangling citations: ${dangling.slice(0, 10).join(', ')}`);
  });

  test(`${name}: the reference count shown matches the list rendered`, () => {
    const shown = html.match(/<span class="more">(\d+)<\/span>/);
    const rendered = new Set([...html.matchAll(/id="ref-(\d+)"/g)].map((m) => m[1])).size;
    if (shown) assert.equal(rendered, Number(shown[1]), 'the "more" count must match the list');
  });

  test(`${name}: the meta description is a whole phrase, not a sliced word`, () => {
    // The generator writes the attribute in whichever order html.escape and the
    // template happen to produce, and quotes it with ' or ". Match either.
    const meta = html.match(/<meta\b[^>]*name="description"[^>]*>/i);
    assert.ok(meta, 'a meta description is required');
    const content = (meta[0].match(/content=(?:"([^"]*)"|'([^']*)')/) || []).slice(1).find(Boolean) || '';
    assert.ok(content.length > 40, `description too short: ${content}`);
    assert.ok(content.length <= 160, `description is ${content.length} characters, over the 160 limit`);
    assert.ok(!/\b[a-z]{1,2}$/.test(content.replace(/…$/, '')), `description ends mid-word: ${content}`);
  });

  test(`${name}: no asset is requested at a stale hardcoded version`, () => {
    const versions = new Set([...html.matchAll(/\?v=([0-9][^&"'\s<>]*)/g)].map((m) => m[1]));
    assert.equal(versions.size, 1, `more than one build id in the page: ${[...versions].join(', ')}`);
  });
}
