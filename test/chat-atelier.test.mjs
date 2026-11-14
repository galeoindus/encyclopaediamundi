import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { stylesheetOrder } from '../scripts/css-layers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(ROOT, path), 'utf8');
const [html, css, theme] = await Promise.all([
  read('chat/index.html'),
  read('assets/css/chat-atelier.css'),
  read('assets/js/global-theme.js'),
]);

test('chat loads the new final visual layer without replacing the existing shell', () => {
  // The build serves this route's sheets as one bundle, so the assertion is
  // made against the resolved cascade rather than a <link> tag.
  const layers = stylesheetOrder('chat/index.html');
  assert.ok(layers.includes('chat-atelier.css'), `chat-atelier.css missing from ${layers.join(' > ')}`);
  assert.match(html, /id="composer"/);
  assert.match(html, /id="thread"/);
  assert.match(html, /id="railList"/);
});

test('light and dark palettes use the chat route scope only', () => {
  assert.match(css, /body\.amigo-chat\s*\{[\s\S]*?--im-bg: #f5f6ff/);
  assert.match(css, /html\[data-theme="dark"\] body\.amigo-chat\s*\{[\s\S]*?--im-bg: #0c1120/);
  assert.match(theme, /const chatPage = document\.body\?\.classList\.contains\('amigo-chat'\)/);
});

test('the redesign assigns distinct roles to glass, tactile, clay and reading surfaces', () => {
  assert.match(css, /backdrop-filter: blur\(22px\)/);
  assert.match(css, /box-shadow: var\(--im-inset-shadow\)/);
  assert.match(css, /box-shadow: var\(--im-clay-shadow\)/);
  assert.match(css, /body\.amigo-chat \.a\s*\{[\s\S]*?background: var\(--im-surface\)/);
});

test('glass surfaces have a non-blur fallback and reduced-motion support', () => {
  assert.match(css, /@supports not \(\(backdrop-filter: blur\(1px\)\)\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('mobile layout keeps a single-column suggestion grid and compact composer controls', () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /safe-area-inset-bottom/);
});
