/* The answer Amigo gives when it has nothing to cite.
 *
 * The rule this module exists for: a reader who asks a question must get
 * something usable, and it must never be invented. So the fallback is checked
 * for three things — it names real pages, it links to them, and it says plainly
 * that it is not a sourced answer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { siteFallback, matchArticles, matchPages } from '../assets/js/site-fallback.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('a question about a published subject points at that article', () => {
  const hits = matchArticles('how does a black hole form?');
  assert.ok(hits.length > 0, 'no article matched');
  assert.equal(hits[0].slug, 'Black_hole');
});

test('an unmatched question still yields an organised answer', () => {
  const { markdown, articles } = siteFallback('what is the airspeed of a swallow');
  assert.ok(markdown.length > 200, 'the fallback is too thin to be useful');
  assert.equal(articles.length, 0, 'nothing should be claimed to match');
  assert.match(markdown, /could not find a reliable source/i);
});

test('the fallback always links to the three ways of getting a sourced answer', () => {
  const { markdown } = siteFallback('tell me about photosynthesis');
  for (const path of ['/#/ask', '/#/library', '/research/']) {
    assert.ok(markdown.includes(`](${path})`), `no link to ${path}`);
  }
});

test('every article link in a fallback resolves to a real page', () => {
  for (const question of ['black hole', 'ashoka', 'upi payments', 'vedas', 'chess', 'isro']) {
    const { articles } = siteFallback(question);
    for (const article of articles) {
      const file = join(ROOT, 'articles', article.slug, 'index.html');
      assert.ok(existsSync(file), `${article.slug} is linked but has no page`);
    }
  }
});

test('every page link in a fallback is one the site really has', () => {
  const { pages } = siteFallback('privacy and saved history');
  for (const page of pages) {
    if (page.path.startsWith('/#/')) continue; // an app route, checked by the router tests
    const file = join(ROOT, page.path.replace(/^\//, ''), 'index.html');
    const bare = join(ROOT, page.path.replace(/^\//, ''));
    assert.ok(existsSync(file) || existsSync(bare), `${page.path} is linked but does not exist`);
  }
});

test('the fallback says it is not a sourced answer', () => {
  const { markdown } = siteFallback('quantum tunnelling in semiconductors');
  assert.match(markdown, /site’s own library, not from a model|site's own library, not from a model/i);
});

test('the offline reason and the no-source reason read differently', () => {
  const offline = siteFallback('black hole', { reason: 'offline' }).markdown;
  const noSource = siteFallback('black hole', { reason: 'no-source' }).markdown;
  assert.notEqual(offline, noSource);
  assert.match(offline, /could not reach a source/i);
});

test('the Hindi fallback is in Hindi and still links out', () => {
  const { markdown } = siteFallback('प्रकाश संश्लेषण', { lang: 'hi' });
  assert.match(markdown, /साइट|स्रोत/);
  assert.match(markdown, /\]\(\/#\/ask\)/);
});
