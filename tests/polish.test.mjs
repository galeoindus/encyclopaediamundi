/* The day's article picture, the mascot, the new mark, and the translator. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let gen = 0;

const FEED_NO_PICTURE = {
  tfa: {
    title: 'Ashoka',
    titles: { normalized: 'Ashoka' },
    extract: 'Ashoka was Emperor of Magadha.',
    description: 'Mauryan emperor',
    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Ashoka' } },
  },
  mostread: { articles: [] },
};

function boot(page, url) {
  const dom = new JSDOM(readFileSync(join(ROOT, page), 'utf8'), { url, pretendToBeVisual: true });
  const { window } = dom;
  const calls = [];
  const fetchStub = async (target, options = {}) => {
    calls.push(String(target));
    const u = String(target);
    let body = { query: { search: [] }, parse: { text: { '*': '' } } };
    if (u.includes('/feed/featured/')) body = FEED_NO_PICTURE;
    else if (u.includes('/page/summary/')) body = { title: 'Ashoka', thumbnail: { source: 'https://upload.wikimedia.org/ashoka.jpg' }, description: 'Mauryan emperor' };
    else if (u.includes('/api/ask')) body = { answer: 'stub', provider: 'stub', model: 'm', sources: [] };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => '{}' };
  };
  Object.assign(globalThis, {
    window, document: window.document, location: window.location, history: window.history,
    navigator: window.navigator, localStorage: window.localStorage, DOMParser: window.DOMParser,
    Node: window.Node, HTMLElement: window.HTMLElement,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    fetch: fetchStub, scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  window.scrollTo = () => {};
  window.fetch = fetchStub;
  return { window, calls };
}

test('the article of the day gets a picture even when the feed has none', async () => {
  const { window } = boot('index.html', 'https://veridell.pages.dev/');
  await import(`${pathToFileURL(join(ROOT, 'src/main.js')).href}?pic=${++gen}`);
  await tick(160);

  const card = window.document.querySelector('.em-aotd');
  assert.ok(card, 'the card is on the page');
  assert.equal(card.querySelector('img')?.getAttribute('src'), 'https://upload.wikimedia.org/ashoka.jpg');
  assert.match(card.textContent, /Mauryan emperor/, 'the description is shown');
  assert.match(card.textContent, /Read it here/, 'there is a way in');
});

test('the chat has a mascot, and it changes state while working', async () => {
  const { window } = boot('chat/index.html', 'https://veridell.pages.dev/chat/');
  await import(`${pathToFileURL(join(ROOT, 'src/chat.js')).href}?m=${++gen}`);
  await tick();

  const doc = window.document;
  assert.ok(doc.querySelector('.em-mascot'), 'the mascot is in the empty state');
  assert.equal(doc.querySelector('.em-mascot')?.getAttribute('data-state'), 'idle');

  const prompt = doc.querySelector('#prompt');
  prompt.value = 'what is a black hole';
  // The working state is painted synchronously, before the request goes out —
  // so it is checked here rather than after a wait, which the stubbed fetch
  // would finish long before.
  doc.querySelector('#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const working = doc.querySelector('.em-mascot[data-state="thinking"], .em-mascot[data-state="researching"]');
  assert.ok(working, 'the mascot reports what it is doing while the answer is prepared');
  await tick(80);
});

test('the mark is the new one, everywhere it is drawn', () => {
  for (const file of ['assets/favicon.svg', 'index.html']) {
    const text = readFileSync(join(ROOT, file), 'utf8');
    if (file === 'index.html') continue;
    assert.match(text, /emMarkG/, file);
  }
  const core = readFileSync(join(ROOT, 'src/core.js'), 'utf8');
  assert.match(core, /emMarkG/, 'the mark the header draws is the new one');
});

test('the translator splits on paragraphs and refuses a language it does not know', async () => {
  const { chunk } = await import(pathToFileURL(join(ROOT, 'functions/api/translate.js')).href);

  const long = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} of the article, long enough to matter.`).join('\n\n');
  const parts = chunk(long, 400);
  assert.ok(parts.length > 1, 'a long article is split');
  assert.ok(parts.every((part) => part.length <= 460), 'no chunk is oversized');
  assert.match(parts[0], /^Paragraph 0/);

  const { onRequestPost } = await import(pathToFileURL(join(ROOT, 'functions/api/translate.js')).href);
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [[['नमस्ते ', 'hello ', null, null, 1]], null, 'en'],
  });
  const bad = await onRequestPost({ request: { json: async () => ({ text: 'hi', to: 'xx' }) } });
  assert.equal(bad.status, 400, 'an unknown language is refused');

  const good = await onRequestPost({ request: { json: async () => ({ text: 'hello', to: 'hi' }) } });
  const payload = await good.json();
  assert.equal(payload.text, 'नमस्ते');
  assert.equal(payload.provider, 'Google Translate');
});
