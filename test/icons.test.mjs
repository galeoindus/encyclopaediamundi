/* Tests for the icon set.
 *
 * `icon(name, extra)` declared a second parameter and then dropped it, so a
 * caller passing a class got an unclassed icon back with no error anywhere.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { icon, ICONS } from '../assets/js/icons.js';

test('every icon is an svg that is hidden from assistive technology', () => {
  for (const name of Object.keys(ICONS)) {
    const svg = icon(name);
    assert.ok(svg.startsWith('<svg '), name);
    assert.ok(svg.includes('aria-hidden="true"'), name);
    assert.ok(svg.endsWith('</svg>'), name);
  }
});

test('an unknown name yields an empty string, not "undefined"', () => {
  assert.equal(icon('no-such-glyph'), '');
});

test('extra attributes land on the root svg tag', () => {
  const svg = icon('copy', 'class="ic" data-glyph="copy"');
  assert.ok(svg.startsWith('<svg class="ic" data-glyph="copy" '), svg.slice(0, 60));
  assert.equal((svg.match(/<svg /g) || []).length, 1, 'the tag must not be duplicated');
});

test('no extra leaves the markup untouched', () => {
  assert.equal(icon('copy', ''), ICONS.copy);
  assert.equal(icon('copy'), ICONS.copy);
});
