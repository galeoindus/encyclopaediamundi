/* An article page as the site now builds it: Wikipedia's text, Wikidata's
 * facts, Commons' pictures, and the language editions — each asked separately,
 * each allowed to fail on its own.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let gen = 0;

const ARTICLE_HTML = `<div class="mw-parser-output">
  <p><b>A black hole</b> is a region of spacetime where gravity is so strong that nothing, not even light, can escape it. The boundary of no escape is called the event horizon.</p>
  <h2>History</h2><p>John Michell proposed the idea in 1783, and general relativity later described such objects precisely.</p>
  <h2>Formation</h2><p>Black holes form when massive stars collapse at the end of their lives, compressing the core beyond description.</p>
</div>`;

function replyFor(url) {
  const u = String(url);
  if (u.includes('prop=pageprops')) return { query: { pages: { 1: { pageprops: { wikibase_item: 'Q589' } } } } };
  if (u.includes('wbgetentities') && u.includes('ids=Q589')) {
    return { entities: { Q589: {
      descriptions: { en: { value: 'astronomical object' } },
      claims: {
        P31: [{ mainsnak: { datavalue: { value: { id: 'Q193523' } } } }],
        P571: [{ mainsnak: { datavalue: { value: { time: '+1916-01-01T00:00:00Z' } } } }],
      },
    } } };
  }
  if (u.includes('wbgetentities') && u.includes('props=labels')) {
    return { entities: { Q193523: { labels: { en: { value: 'astronomical object' } } } } };
  }
  if (u.includes('prop=images')) return { query: { pages: { 1: { images: [{ title: 'File:Black hole.jpg' }] } } } };
  if (u.includes('prop=imageinfo')) {
    return { query: { pages: { 1: { title: 'File:Black hole.jpg', imageinfo: [{
      thumburl: 'https://upload.wikimedia.org/black-hole-640.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Black_hole.jpg',
      extmetadata: { Artist: { value: 'NASA' }, LicenseShortName: { value: 'Public domain' } },
    }] } } } };
  }
  if (u.includes('prop=langlinks')) return { query: { pages: { 1: { langlinks: [{ lang: 'hi', '*': 'ब्लैक होल' }] } } } };
  if (u.includes('action=parse')) return { parse: { title: 'Black hole', text: { '*': ARTICLE_HTML }, sections: [] } };
  if (u.includes('/page/summary/')) return { title: 'Black hole', thumbnail: { source: 'https://upload.wikimedia.org/lead.jpg' }, description: 'astronomical object' };
  return { query: { search: [{ title: 'Black hole' }], pages: {} } };
}

function boot(hash) {
  const dom = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8'), { url: `https://veridell.pages.dev/${hash}`, pretendToBeVisual: true });
  const { window } = dom;
  const fetchStub = async (url) => ({
    ok: true, status: 200,
    headers: { get: () => 'application/json' },
    json: async () => replyFor(url),
    text: async () => '{}',
  });
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
  return window;
}

async function open(hash) {
  const window = boot(hash);
  await import(`${pathToFileURL(join(ROOT, 'src/main.js')).href}?svc=${++gen}`);
  await tick(200);
  return window;
}

test('an article page carries Wikipedia text, Wikidata facts and Commons pictures', async () => {
  const window = await open('#/article/Black_hole');
  const doc = window.document;

  assert.ok(doc.querySelector('.em-answer h1'), 'the article title is on the page');
  assert.match(doc.querySelector('.em-lead')?.textContent || '', /black hole/i, 'the lead is rendered');

  const facts = doc.querySelector('.em-facts');
  assert.ok(facts, 'the facts panel is on the page');
  assert.match(facts.textContent, /Type/);
  assert.match(facts.textContent, /astronomical object/);

  const pics = doc.querySelectorAll('.em-pic');
  assert.equal(pics.length, 1, 'one Commons picture');
  assert.equal(pics[0].querySelector('img')?.getAttribute('src'), 'https://upload.wikimedia.org/black-hole-640.jpg');
  assert.match(pics[0].textContent, /Public domain/);
});

test('the source block links back to every service that was used', async () => {
  const window = await open('#/article/Black_hole');
  const links = [...window.document.querySelectorAll('.em-source')].map((a) => a.getAttribute('href'));
  assert.ok(links.some((href) => href?.includes('en.wikipedia.org/wiki/Black_hole')), 'Wikipedia');
  assert.ok(links.some((href) => href?.includes('wikidata.org/wiki/Q589')), 'Wikidata');
  assert.ok(links.some((href) => href?.includes('commons.wikimedia.org')), 'Commons');
});

test('the answer offers the other language editions', async () => {
  const window = await open('#/article/Black_hole');
  const chips = [...window.document.querySelectorAll('.em-lang-chip')].map((b) => b.textContent);
  assert.ok(chips.includes('हिन्दी'), 'the language row is on the page');
});

test('a language with no edition says so instead of pretending', async () => {
  const window = await open('#/article/Black_hole?lang=fr');
  const page = window.document.querySelector('.em-page');
  assert.ok(page, 'a note is shown');
  assert.match(page.textContent, /No edition in that language yet/);
});
