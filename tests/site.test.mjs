/* The checks that keep the site honest.
 *
 * No DOM is needed for any of these: they test the pieces that decide what a
 * reader is told — the answer builder, the citation sanitiser, the prompt, and
 * the files that make the site crawlable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { markdown } from '../src/markdown.js';
import { messagesFor, normalisePassages, openRouterKeys } from '../functions/api/ask.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

/* ── markdown ───────────────────────────────────────────────────────────── */

test('markdown turns headings, lists and bold into elements', () => {
  const html = markdown('# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two');
  assert.match(html, /<h2>Title<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
});

test('markdown escapes anything a model writes', () => {
  const html = markdown('<script>alert(1)</script> & "quotes"');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('a citation marker becomes a link only when a source exists', () => {
  assert.match(markdown('Fact [1].', { cites: 2 }), /class="em-cite" href="#src-1"/);
  assert.doesNotMatch(markdown('Fact [3].', { cites: 2 }), /em-cite/);
});

test('only http(s) links survive', () => {
  const html = markdown('[x](javascript:alert(1)) and [ok](https://example.org/a)');
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /href="https:\/\/example.org\/a"/);
});

/* ── the endpoint's contract ────────────────────────────────────────────── */

test('a grounded prompt carries the passages and forbids invention', () => {
  const messages = messagesFor({
    mode: 'grounded',
    question: 'What is a black hole?',
    passages: [{ title: 'Black hole', text: 'A black hole is a region of spacetime where gravity is so strong that nothing can escape it. '.repeat(3), sourceType: 'Wikipedia' }],
    depth: 'detailed',
    history: [],
  });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /PASSAGES/);
  assert.match(messages[0].content, /never fill the gap from memory/i);
  assert.equal(messages.at(-1).content, 'What is a black hole?');
});

test('a chat prompt asks for a plain answer with no citations', () => {
  const messages = messagesFor({ mode: 'chat', question: 'hello', passages: [], depth: 'quick', history: [] });
  assert.match(messages[0].content, /Never invent citations/i);
  assert.doesNotMatch(messages[0].content, /PASSAGES/);
});

test('history is trimmed, cleaned and never grows the prompt', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` }));
  const messages = messagesFor({ mode: 'chat', question: 'q', passages: [], depth: 'detailed', history });
  assert.equal(messages.length, 1 + 6 + 1);
});

test('passages are validated and capped', () => {
  const rows = normalisePassages([
    { title: 'A', text: 'x'.repeat(200), url: 'https://en.wikipedia.org/wiki/A' },
    { title: 'B', text: 'short', url: 'javascript:alert(1)' },
    { title: '', text: 'y'.repeat(200) },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, 'https://en.wikipedia.org/wiki/A');
});

test('OpenRouter keys are read from the numbered slots and the legacy one', () => {
  const keys = openRouterKeys({ OPENROUTER_API_KEY_1: 'a', OPENROUTER_API_KEY_3: 'c', OPENROUTER_API_KEY: 'z' });
  assert.deepEqual(keys, ['a', 'c', 'z']);
});

/* ── the crawlable surface ──────────────────────────────────────────────── */

test('every page the sitemap names exists on disk', () => {
  const sitemap = read('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>https:\/\/[^/]+\/([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length >= 10, 'the sitemap lists the site');
  for (const path of urls) {
    const file = path === '' ? 'index.html' : join(path, 'index.html');
    assert.ok(existsSync(join(ROOT, file)), `${path} is in the sitemap but has no page`);
  }
});

test('robots.txt names the sitemap and keeps the pages open', () => {
  const robots = read('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/veridell\.pages\.dev\/sitemap\.xml/);
  assert.match(robots, /User-agent: \*\nAllow: \//);
});

test('no page claims a canonical host that is not the deployed one', () => {
  const origin = 'https://veridell.pages.dev';
  for (const page of ['index.html', 'chat/index.html', 'articles/index.html', 'help/index.html']) {
    const html = read(page);
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(canonical?.startsWith(origin), `${page} canonical is ${canonical}`);
  }
});

test('the article pages carry their source and their licence', () => {
  const html = read('articles/Ashoka/index.html');
  assert.match(html, /en\.wikipedia\.org\/wiki\/Ashoka/);
  assert.match(html, /CC BY-SA 4\.0/);
  assert.match(html, /"@type":"Article"/);
});

test('the site ships no inline event handlers in the app shell', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script>[^<]*document\./);
});
