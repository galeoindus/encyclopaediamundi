/* An audit that presses every control and reports what actually changed.
 *
 * Not a test: a report. It boots the real pages in a DOM, clicks and types, and
 * prints one line per control — so a dead button is a line in the output
 * instead of something a reader discovers.
 */

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let gen = 0;

function boot(page, url) {
  const dom = new JSDOM(readFileSync(join(ROOT, page), 'utf8'), { url, pretendToBeVisual: true });
  const { window } = dom;
  const fetchStub = async (target) => {
    const body = String(target).includes('/api/ask')
      ? { answer: 'stub [1]', provider: 'stub', model: 'm', sources: [] }
      : { query: { search: [] }, parse: { text: { '*': '<p>x</p>' } }, mostread: { articles: [] } };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => '{}' };
  };
  Object.assign(globalThis, {
    window, document: window.document, location: window.location, history: window.history,
    navigator: window.navigator, localStorage: window.localStorage, DOMParser: window.DOMParser, Node: window.Node,
    HTMLElement: window.HTMLElement, requestAnimationFrame: (fn) => setTimeout(fn, 0),
    fetch: fetchStub, scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  window.scrollTo = () => {};
  window.fetch = fetchStub;
  return window;
}

const report = [];
const line = (area, control, verdict) => report.push(`${area.padEnd(10)} ${control.padEnd(28)} ${verdict}`);

async function auditApp() {
  const window = boot('index.html', 'https://veridell.pages.dev/');
  await import(`${pathToFileURL(join(ROOT, 'src/main.js')).href}?audit=${++gen}`);
  await tick();
  const doc = window.document;

  // theme
  const themeBtn = doc.querySelector('[data-theme-toggle]');
  const before = doc.documentElement.dataset.theme;
  themeBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  line('app', 'theme toggle', themeBtn ? (doc.documentElement.dataset.theme !== before ? 'works' : 'DEAD') : 'missing');

  // language
  const lang = doc.querySelector('#em-lang');
  if (lang) {
    lang.value = 'hi';
    lang.dispatchEvent(new window.Event('change', { bubbles: true }));
    await tick();
    line('app', 'source language', localStorage.getItem('em:lang') ? 'works' : 'DEAD (not saved)');
  } else line('app', 'source language', 'missing');

  // ask box
  const form = doc.querySelector('.em-ask');
  const input = doc.querySelector('.em-ask input');
  if (form && input) {
    input.value = 'chess';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(80);
    line('app', 'ask box submit', window.location.hash.includes('/ask') ? 'works' : `DEAD (hash ${window.location.hash})`);
  } else line('app', 'ask box', 'missing');

  // navigation
  for (const href of ['#/explore', '#/today', '#/library', '#/sources', '#/saved']) {
    window.location.hash = href;
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await tick(80);
    const view = doc.getElementById('view');
    line('route', href, view.children.length ? 'paints' : 'BLANK');
  }

  // credits / attribution
  window.location.hash = '#/credits';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await tick(80);
  line('route', '#/credits', doc.querySelector('.em-page h1')?.textContent?.includes('Credit') ? 'paints' : 'MISSING');
}

async function auditChat() {
  const window = boot('chat/index.html', 'https://veridell.pages.dev/chat/');
  await import(`${pathToFileURL(join(ROOT, 'src/chat.js')).href}?audit=${++gen}`);
  await tick();
  const doc = window.document;

  const runtime = doc.querySelector('#runtime');
  runtime.value = 'local';
  runtime.dispatchEvent(new window.Event('change', { bubbles: true }));
  line('chat', 'runtime switch', doc.querySelector('#ollamaRow').hidden === false ? 'works' : 'DEAD');

  const depth = doc.querySelector('#depth');
  depth.value = 'deep';
  depth.dispatchEvent(new window.Event('change', { bubbles: true }));
  line('chat', 'depth select', localStorage.getItem('em:depth') ? 'works' : 'DEAD');

  const composer = doc.querySelector('#composer');
  const prompt = doc.querySelector('#prompt');
  runtime.value = 'cloud';
  runtime.dispatchEvent(new window.Event('change', { bubbles: true }));
  prompt.value = 'what is a black hole';
  composer.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick(120);
  line('chat', 'send a question', doc.querySelector('.em-turn-a') ? 'works' : 'DEAD');

  const clear = doc.querySelector('#clearChat');
  clear?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await tick(60);
  line('chat', 'new chat', doc.querySelector('.em-chat-empty') ? 'works' : 'DEAD');

  line('chat', 'voice input', doc.querySelector('#micBtn') ? 'present' : 'MISSING');
  line('chat', 'attach a file', doc.querySelector('#attachBtn') ? 'present' : 'MISSING');
  line('chat', 'stop a request', doc.querySelector('#send')?.getAttribute('aria-label') ? 'present' : 'missing');
}

await auditApp();
await auditChat();
console.log(report.join('\n'));
