/* The surface system, as a contract rather than a taste.
 *
 * Three materials, used for three jobs: clay for cards, glass for what floats,
 * neumo for what is pressed. The front page is made of cards; a single picture
 * is centred and a set of pictures runs in one horizontal line; and no text is
 * clipped mid-word.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'styles/site.css'), 'utf8');
const views = readFileSync(join(ROOT, 'src/views.js'), 'utf8');

test('the three materials are declared', () => {
  assert.match(css, /--em-clay-face:/, 'clay');
  assert.match(css, /--em-glass:/, 'glass');
  assert.match(css, /--em-neu-in:/, 'neumo');
  assert.match(css, /backdrop-filter: blur\(18px\)/, 'the floating bar is glass');
  assert.match(css, /\.em-depth \{ box-shadow: var\(--em-neu-in\); \}/, 'the depth bar is pressed in');
});

test('every card shares one material', () => {
  const rule = /\.em-card,\s*\.em-aotd,[\s\S]{0,400}?background: var\(--em-clay-face\)/.exec(css);
  assert.ok(rule, 'the cards are drawn in clay');
});

test('the front page is made of cards, not bare sections', () => {
  const panels = views.match(/class: 'em-panel/g) || [];
  assert.ok(panels.length >= 4, `expected the front page sections to be panels, found ${panels.length}`);
});

test('one picture is centred and several run in one horizontal line', () => {
  assert.match(views, /em-pics\$\{answer\.images\.length === 1 \? ' em-pics--single' : ''\}/);
  assert.match(css, /\.em-pics--single \{[\s\S]*?text-align: center;/);
  assert.match(css, /\.em-pics \{[\s\S]*?grid-auto-flow: column;[\s\S]*?overflow-x: auto;/);
});

test('the reading column is wide enough for a long word and a long line', () => {
  assert.match(css, /--em-column: 88ch/);
  assert.match(css, /\.em-main \{ max-width: 1220px/);
});

test('nothing is clipped mid-word', () => {
  assert.doesNotMatch(css, /-webkit-line-clamp/);
  assert.match(css, /overflow-wrap: anywhere/);
});
