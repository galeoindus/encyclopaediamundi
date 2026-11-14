/* The article-to-answer builder, on markup shaped like the Wikipedia parser's.
 *
 * This is the step that decides whether an article page is a page at all: if
 * the outline comes back empty, the reader gets a title and nothing under it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.DOMParser = dom.window.DOMParser;

const { composeAnswer, outline, cleanArticle, keySentences } = await import('../src/answer.js');

const HTML = `
<div class="mw-parser-output">
  <table class="infobox"><tr><td>infobox junk</td></tr></table>
  <p><b>A black hole</b> is a region of spacetime where gravity is so strong that nothing, not even light, can escape it. General relativity predicts that a sufficiently compact mass can deform spacetime to form a black hole. The boundary of no escape is called the event horizon.</p>
  <div class="thumb"><img src="x.jpg"></div>
  <h2><span class="mw-headline" id="History">History</span></h2>
  <p>The idea of a body so massive that even light could not escape was briefly proposed by John Michell in 1783. Einstein's theory made it possible to describe such objects precisely.</p>
  <h2>Formation</h2>
  <p>Black holes form when massive stars collapse at the end of their life cycle. The collapse compresses the core beyond the point where known physics can describe it.</p>
  <h2>References</h2>
  <p>a reference list</p>
</div>`;

test('the furniture is removed and the prose is kept', () => {
  const root = cleanArticle(HTML);
  const text = root.textContent;
  assert.doesNotMatch(text, /infobox junk/);
  assert.match(text, /event horizon/);
});

test('the outline finds a lead and numbered sections', () => {
  const { lead, topics } = outline(cleanArticle(HTML));
  assert.ok(lead.length >= 1, 'a lead paragraph survives');
  assert.deepEqual(topics.map((topic) => topic.heading), ['History', 'Formation']);
});

test('the sentences that answer the question come first', () => {
  const sentences = keySentences(['A black hole is a region of spacetime. Light cannot escape it.'], 'black hole escape', 1);
  assert.match(sentences[0], /black hole|escape/i);
});

test('an answer carries a lead, key points and topics at every depth', () => {
  for (const depth of ['quick', 'detailed', 'deep']) {
    const answer = composeAnswer({ title: 'Black hole', html: HTML, question: 'what is a black hole', depth, url: 'https://en.wikipedia.org/wiki/Black_hole' });
    assert.ok(answer.lead.length > 40, `${depth}: lead`);
    assert.ok(answer.topics.length >= 1, `${depth}: topics`);
    assert.equal(answer.url, 'https://en.wikipedia.org/wiki/Black_hole');
  }
});

test('an article with no headings still produces a lead', () => {
  const answer = composeAnswer({ title: 'X', html: '<p>One long paragraph that says something worth reading about the subject at hand, long enough to survive the length test.</p>', question: 'x', depth: 'quick' });
  assert.ok(answer.lead.length > 20);
  assert.deepEqual(answer.topics, []);
});
