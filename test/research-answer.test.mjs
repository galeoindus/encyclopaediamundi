/* Tests for the Research Desk answer layer.
 *
 * The bug these pin: `sentences()` tested the sentence built so far for a
 * trailing abbreviation, not the piece it had just read. One join made the
 * accumulation end in an ordinary word, the chain stopped, and "Dr. A. P. J."
 * fell out as fragments too short to keep — so the lead of an article about a
 * person lost the name it opens with.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { sentences, compose } from '../assets/js/research-answer.js';

test('an honorific does not cut the lead in two', () => {
  const out = sentences('Dr. A. P. J. Abdul Kalam was the eleventh president of India and served from 2002 to 2007.');
  assert.equal(out.length, 1, `expected one sentence, got ${JSON.stringify(out)}`);
  assert.ok(out[0].startsWith('Dr. A. P. J. Abdul Kalam'), out[0]);
});

test('the abbreviation chain survives more than one join', () => {
  const out = sentences('Mr. and Mrs. Rao lived in No. 5 Squadron Lines for many years after the war.');
  assert.equal(out.length, 1, JSON.stringify(out));
  assert.ok(out[0].startsWith('Mr. and Mrs. Rao'), out[0]);
});

test('an ordinary full stop still splits', () => {
  const out = sentences('The mission launched in July 2023. It landed near the lunar south pole later that year.');
  assert.equal(out.length, 2, JSON.stringify(out));
});

test('a date abbreviation still joins', () => {
  const out = sentences('Ashoka ruled from c. 268 BCE until his death in 232 BCE across most of the subcontinent.');
  assert.equal(out.length, 1, JSON.stringify(out));
});

test('the answer keeps the name the lead opens with', () => {
  const lead = 'Dr. A. P. J. Abdul Kalam was the eleventh president of India and he served from 2002 until 2007.';
  const answer = compose({ title: 'A. P. J. Abdul Kalam', lead, question: 'who was the president of India' });
  assert.ok(answer.answer.startsWith('Dr. A. P. J. Abdul Kalam'), answer.answer);
});
