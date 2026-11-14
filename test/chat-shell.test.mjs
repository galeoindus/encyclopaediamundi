/* The chat shell: one scrolling column, one fixed composer, one design layer. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { stylesheetOrder } from '../scripts/css-layers.mjs';

const html = readFileSync(new URL('../chat/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/css/squircle.css', import.meta.url), 'utf8');
const atelier = readFileSync(new URL('../assets/css/chat-atelier.css', import.meta.url), 'utf8');
const experience = readFileSync(new URL('../assets/css/chat-experience.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../assets/js/chat-page.js', import.meta.url), 'utf8');
const storage = readFileSync(new URL('../assets/js/chat-storage.js', import.meta.url), 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

test('the composer is a row of the column, not a sticky element in the scroller', () => {
  const dock = doc.querySelector('#dock');
  const scroll = doc.querySelector('#main');
  assert.ok(dock && scroll);
  assert.equal(dock.parentElement.className, 'main');
  assert.equal(scroll.parentElement.className, 'main');
  assert.equal(dock.parentElement, scroll.parentElement);
  // header, scroller, composer — in that order, so the composer is always last.
  assert.deepEqual([...dock.parentElement.children].map((n) => n.className), ['top', 'scroll', 'dock']);
  assert.equal(scroll.contains(dock), false);
});

test('the final chat refinement follows the layout/squircle layer', () => {
  const sheets = stylesheetOrder('chat/index.html');
  assert.equal(sheets.at(-6), 'chat-atelier.css', sheets.join(' > '));
  assert.equal(sheets.at(-5), 'chat-experience.css', sheets.join(' > '));
  assert.equal(sheets.at(-4), 'chat-capabilities.css', sheets.join(' > '));
  // The accessibility preferences layer settles the tokens…
  assert.equal(sheets.at(-3), 'preferences.css', sheets.join(' > '));
  assert.equal(sheets.at(-2), 'chat-ai-mode.css', sheets.join(' > '));
  // …and the AI Mode surface, the search-shaped layer, has the last word.
  assert.equal(sheets.at(-1), 'chat-google-mode.css', sheets.join(' > '));
  assert.ok(sheets.indexOf('squircle.css') < sheets.indexOf('chat-atelier.css'));
  assert.match(css, /corner-shape: squircle/);
  // The header comment wraps, so match the declared design language without
  // depending on where the line break falls.
  assert.match(atelier, /aurora ambience[\s\S]{0,40}glass chrome[\s\S]{0,40}tactile/);
  assert.match(experience, /Swiss\/editorial/);
  assert.match(experience, /Bauhaus \+ Memphis/);
  assert.match(experience, /Frutiger-Aero/);
  assert.match(experience, /Holographic edge/);
  assert.match(css, /@supports \(corner-shape: squircle\)/);
});

test('every icon in the header is drawn in the same box', () => {
  const buttons = [...doc.querySelectorAll('.top .ico, .top .rail-toggle')];
  assert.ok(buttons.length >= 3);
  for (const button of buttons) {
    const svg = button.querySelector('svg');
    assert.ok(svg, 'each icon button has an svg');
    assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  }
  // The layer pins one size per role instead of inheriting whatever the
  // previous stylesheet left behind.
  assert.match(css, /--ico-md: 19px/);
  assert.match(css, /body\.amigo-chat \.ico svg[\s\S]*?width: var\(--ico-md\)/);
  assert.match(css, /stroke-linecap: round/);
});

test('the composer controls are one size and centred', () => {
  assert.match(css, /\.composer \.plus,[\s\S]*?\.composer \.mic,[\s\S]*?\.composer \.send \{[\s\S]*?width: 40px;[\s\S]*?height: 40px;/);
  assert.match(css, /display: inline-flex;[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/);
});

test('the model picker is free-first, empty until opened, and never discovers on load', () => {
  const picker = doc.querySelector('#modelChoice');
  assert.ok(picker, 'the chat page offers a model picker');
  // Nothing is baked into the markup: the list is built from /api/models, so
  // the page never names a model it has not been told exists.
  assert.deepEqual([...picker.options].map((option) => option.value), ['auto']);
  assert.equal(doc.querySelector('#modelNote')?.hidden, true);
  // Free runtimes are grouped first, and a paid model is never the default.
  assert.match(js, /group\('Cloudflare Workers AI · free', free\)/);
  assert.match(js, /group\('OpenRouter · free models'/);
  assert.match(js, /const autoText = modelMenu\.free/);
  // Discovery is lazy: one call, from the options panel, not from page load.
  // The declaration has no semicolon; every call site does, so this counts
  // callers only.
  const calls = js.match(/loadModelMenu\(\);/g) || [];
  assert.equal(calls.length, 1, 'loadModelMenu is called exactly once');
  assert.match(js, /if \(!modelMenu\.loaded\) loadModelMenu\(\);/);
  assert.match(js, /model: chosenModel\(\)/);
});

test('the rail says which model will answer', () => {
  const foot = doc.querySelector('.rail-foot');
  assert.ok(foot);
  assert.ok(doc.querySelector('#railModel'));
  assert.match(js, /function paintRailModel/);
});

test('nothing on the chat page can scroll sideways', () => {
  assert.match(css, /body\.amigo-chat \.main \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /max-width: 100%;\n  min-width: 0;/);
});

test('reduced motion is honoured', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});


test('conversation mode and local-only privacy explanation are visible', () => {
  const mode = doc.querySelector('#conversationMode');
  assert.ok(mode);
  assert.deepEqual([...mode.options].map((option) => option.value), ['auto', 'chat', 'research']);
  const note = doc.querySelector('#chatNote')?.textContent || '';
  assert.match(note, /No sign-in, email, phone number or personal profile/);
  assert.match(note, /saved in this browser/);
  assert.match(note, /hosting service/);
});


test('thread history is stored through the bounded local/session adapter', () => {
  assert.ok(js.includes('const MAX_STORED_THREADS = 16'));
  assert.ok(js.includes('const MAX_STORED_MESSAGES = 20'));
  assert.ok(js.includes('function compactMessagesForStorage'));
  assert.ok(js.includes('saveChatState('));
  assert.ok(js.includes('readChatBackup('));
  assert.ok(storage.includes('local.removeItem(KEYS.legacyThread)'));
  assert.ok(storage.includes('local.removeItem(KEYS.legacyRecent)'));
  assert.ok(storage.includes('CHAT_SESSION_BACKUP_KEY'));
});
