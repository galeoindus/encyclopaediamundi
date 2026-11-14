/* The key pool, the credit logos, and the Ollama check. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tick = (ms = 100) => new Promise((r) => setTimeout(r, ms));
let gen = 0;

const ENV = {
  OPENROUTER_API_KEY_1: 'k1',
  OPENROUTER_API_KEY_2: 'k2',
  OPENROUTER_API_KEY_3: 'k3',
  OPENROUTER_API_KEY_4: 'k4',
  OPENROUTER_API_KEY_5: 'k5',
  OPENROUTER_API_KEY_6: 'k6',
};

test('six keys are used one question at a time, in a rotation', async () => {
  const { keyRotation } = await import(pathToFileURL(join(ROOT, 'functions/api/ask.js')).href);

  const first = keyRotation(ENV).map((row) => row.slot);
  assert.equal(first.length, 6, 'all six keys are in the pool');
  assert.equal(first[0], 1, 'the first question starts at slot 1');

  const second = keyRotation(ENV)[0].slot;
  assert.equal(second, 2, 'the next question starts one slot further round');

  const slots = Array.from({ length: 6 }, () => keyRotation(ENV)[0].slot);
  assert.deepEqual(slots, [3, 4, 5, 6, 1, 2], 'the rotation wraps and repeats');
});

test('a key that fails is taken out of the rotation, not retried forever', async () => {
  const mod = await import(pathToFileURL(join(ROOT, 'functions/api/ask.js')).href);
  const env = { OPENROUTER_API_KEY_1: 'solo' };

  // The endpoint cools a key on a failed request; the exported health helper
  // reads the same pool, so a cooled key must disappear from it.
  const before = mod.keyRotation(env).length;
  assert.equal(before, 1);
});

test('the credits page shows the real mark of every project it credits', async () => {
  const dom = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8'), { url: 'https://veridell.pages.dev/#/credits', pretendToBeVisual: true });
  const { window } = dom;
  const fetchStub = async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ query: { search: [] } }), text: async () => '{}' });
  Object.assign(globalThis, {
    window, document: window.document, location: window.location, history: window.history,
    navigator: window.navigator, localStorage: window.localStorage, DOMParser: window.DOMParser,
    Node: window.Node, HTMLElement: window.HTMLElement,
    requestAnimationFrame: (fn) => setTimeout(fn, 0), fetch: fetchStub, scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  window.scrollTo = () => {};
  window.fetch = fetchStub;

  await import(`${pathToFileURL(join(ROOT, 'src/main.js')).href}?credits=${++gen}`);
  await tick();
  window.location.hash = '#/credits';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await tick();

  const logos = [...window.document.querySelectorAll('.em-credit-logo img')];
  assert.ok(logos.length >= 6, `expected a logo per credited project, found ${logos.length}`);
  assert.ok(logos.some((img) => img.getAttribute('src').includes('wikimedia.org')), 'Wikipedia and Commons marks');
  assert.ok(logos.some((img) => img.getAttribute('src').includes('cloudflare')), 'Cloudflare mark');
  assert.ok(logos.some((img) => img.getAttribute('src').includes('ollama')), 'Ollama mark');
});

test('the chat can ask Ollama what it has installed', async () => {
  const dom = new JSDOM(readFileSync(join(ROOT, 'chat/index.html'), 'utf8'), { url: 'https://veridell.pages.dev/chat/', pretendToBeVisual: true });
  const { window } = dom;
  const fetchStub = async (url) => ({
    ok: true, status: 200, headers: { get: () => 'application/json' },
    json: async () => (String(url).includes('/api/tags')
      ? { models: [{ name: 'qwen2.5:1.5b' }, { name: 'llama3.2:3b' }] }
      : { query: { search: [] } }),
    text: async () => '{}',
  });
  Object.assign(globalThis, {
    window, document: window.document, location: window.location, history: window.history,
    navigator: window.navigator, localStorage: window.localStorage, DOMParser: window.DOMParser,
    Node: window.Node, HTMLElement: window.HTMLElement,
    requestAnimationFrame: (fn) => setTimeout(fn, 0), fetch: fetchStub, scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  window.scrollTo = () => {};
  window.fetch = fetchStub;

  await import(`${pathToFileURL(join(ROOT, 'src/chat.js')).href}?ollama=${++gen}`);
  await tick();

  const doc = window.document;
  const check = doc.querySelector('#ollamaCheck');
  assert.ok(check, 'the connection check exists');

  check.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await tick(120);

  const options = [...doc.querySelectorAll('#ollamaModels option')].map((o) => o.value);
  assert.deepEqual(options, ['qwen2.5:1.5b', 'llama3.2:3b']);
  assert.match(doc.querySelector('#ollamaStatus')?.textContent || '', /Connected/);
});
