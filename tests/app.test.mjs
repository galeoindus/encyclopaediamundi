/* Boot the real app in a DOM and see whether it actually works.
 *
 * jsdom cannot run module <script> tags, so the page's own modules are imported
 * here after the globals are wired up. That is close enough to a browser to
 * catch the things that make a page look dead: a module that throws on import,
 * a view that renders nothing, a route that never paints.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function boot(page, { hash = '#/' } = {}) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const dom = new JSDOM(html, {
    url: `https://veridell.pages.dev/${hash}`,
    pretendToBeVisual: true,
  });
  const { window } = dom;

  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  const calls = [];
  const fetchStub = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const body = String(url).includes('/api/ask')
      ? { answer: 'A stub answer [1].', provider: 'stub', model: 'stub-model', sources: [] }
      : { query: { search: [] }, parse: { text: { '*': '<p>stub</p>' } } };
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };

  Object.assign(globalThis, {
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    navigator: window.navigator,
    localStorage,
    DOMParser: window.DOMParser,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    fetch: fetchStub,
    scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  window.scrollTo = () => {};
  window.fetch = fetchStub;

  return { dom, window, calls, store };
}

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

test('the home page renders its hero and the ask box', async () => {
  const { window } = boot('index.html');
  await import(pathToFileURL(join(ROOT, 'src/main.js')).href);
  await tick();

  const doc = window.document;
  assert.ok(doc.querySelector('.em-hero'), 'the hero is on the page');
  assert.ok(doc.querySelector('.em-ask input'), 'the ask box is on the page');
  assert.match(doc.querySelector('h1')?.textContent || '', /answer/i);
  assert.ok(doc.querySelector('.em-nav'), 'the navigation is painted');
});

test('every route paints something, and none of them throws', async () => {
  const { window } = boot('index.html');
  await import(pathToFileURL(join(ROOT, 'src/main.js')).href);
  await tick();

  for (const route of ['#/sources', '#/saved', '#/explore', '#/today', '#/library?q=chess', '#/nope']) {
    window.location.hash = route;
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await tick(60);
    const view = window.document.getElementById('view');
    assert.ok(view.children.length, `${route} painted nothing`);
  }
});

test('the chat page wires its composer and answers a question', async () => {
  const { window, calls } = boot('chat/index.html');
  await import(pathToFileURL(join(ROOT, 'src/chat.js')).href);
  await tick();

  const doc = window.document;
  assert.ok(doc.querySelector('.em-chat-empty'), 'the empty state is painted');
  assert.ok(doc.querySelector('.em-composer textarea'), 'the composer is there');

  const form = doc.querySelector('#composer');
  const input = doc.querySelector('#prompt');
  input.value = 'What is a black hole?';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick(120);

  assert.ok(doc.querySelector('.em-turn-q'), 'the question is in the thread');
  assert.ok(doc.querySelector('.em-prose'), 'an answer was rendered');
  assert.ok(calls.some((call) => call.url.includes('/api/ask')), 'the endpoint was called');
});
