/* The controls that were dead, and the two that were missing.
 *
 * Each test presses the real control on the real page: the theme switch after a
 * navigation, the credits page, dictation, and a file attached to a question.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let gen = 0;

function boot(page, url) {
  const dom = new JSDOM(readFileSync(join(ROOT, page), 'utf8'), { url, pretendToBeVisual: true });
  const { window } = dom;
  const calls = [];
  const fetchStub = async (target, options = {}) => {
    calls.push({ url: String(target), body: options?.body });
    const body = String(target).includes('/api/ask')
      ? { answer: 'stub [1]', provider: 'stub', model: 'm', sources: [] }
      : { query: { search: [] }, parse: { text: { '*': '<p>x</p>' } }, mostread: { articles: [] } };
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

async function open(page, url, module) {
  const booted = boot(page, url);
  await import(`${pathToFileURL(join(ROOT, module)).href}?c=${++gen}`);
  await tick();
  return booted;
}

test('the theme switch still works after the header has been rebuilt', async () => {
  const { window } = await open('index.html', 'https://veridell.pages.dev/', 'src/main.js');
  const doc = window.document;

  // navigate once: this replaces the header, and with it the old button
  window.location.hash = '#/sources';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await tick();

  const before = doc.documentElement.dataset.theme;
  doc.querySelector('[data-theme-toggle]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.notEqual(doc.documentElement.dataset.theme, before, 'the theme changed');
  assert.equal(JSON.parse(window.localStorage.getItem('em:theme')), doc.documentElement.dataset.theme);
});

test('the credits page names the sources, the infrastructure and the licence', async () => {
  const { window } = await open('index.html', 'https://veridell.pages.dev/', 'src/main.js');
  window.location.hash = '#/credits';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await tick();

  const page = window.document.querySelector('.em-page');
  assert.ok(page, 'the credits page rendered');
  assert.match(page.textContent, /Credits/i);
  assert.match(page.textContent, /Wikipedia/);
  assert.match(page.textContent, /Wikimedia Commons/);
  assert.match(page.textContent, /CC BY-SA 4\.0/);
  assert.match(page.textContent, /MIT/);
  assert.match(page.textContent, /Bhola Kumar/);
});

test('the chat offers dictation and a file attachment', async () => {
  const { window } = await open('chat/index.html', 'https://veridell.pages.dev/chat/', 'src/chat.js');
  const doc = window.document;
  assert.ok(doc.querySelector('#micBtn'), 'the microphone control exists');
  assert.ok(doc.querySelector('#attachBtn'), 'the attach control exists');
  assert.ok(doc.querySelector('#fileInput'), 'the file input exists');
  assert.ok(doc.querySelector('#attachmentTray'), 'the tray exists');
});

test('an attached file travels with the question', async () => {
  const { window, calls } = await open('chat/index.html', 'https://veridell.pages.dev/chat/', 'src/chat.js');
  const doc = window.document;

  // jsdom has no File.text in every version, so the tray is filled the way the
  // reader's file lands there: name and text.
  const input = doc.querySelector('#fileInput');
  const file = new window.File(['The monsoon arrives in June.'], 'notes.txt', { type: 'text/plain' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await tick();

  const tray = doc.querySelector('#attachmentTray');
  assert.equal(tray.hidden, false, 'the tray shows the file');

  const prompt = doc.querySelector('#prompt');
  prompt.value = 'when does the monsoon arrive?';
  doc.querySelector('#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick(140);

  const ask = calls.find((call) => call.url.includes('/api/ask'));
  assert.ok(ask, 'the endpoint was called');
  const body = JSON.parse(ask.body);
  assert.equal(body.attachments?.[0]?.name, 'notes.txt');
  assert.match(body.attachments[0].text, /monsoon/);
});
