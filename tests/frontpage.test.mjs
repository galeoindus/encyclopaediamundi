/* The front page: article of the day, picture of the day, most read.
 *
 * These three come from one Wikimedia feed. The test stubs that feed with the
 * shape the API actually returns and checks that all three land on the page —
 * with their pictures, because a front page without images is the thing the
 * reader asked for and did not get.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FEED = {
  tfa: {
    title: 'Black hole',
    titles: { normalized: 'Black hole' },
    extract: 'A black hole is a region of spacetime where gravity is so strong that nothing can escape it.',
    description: 'Astronomical object',
    thumbnail: { source: 'https://upload.wikimedia.org/black-hole.jpg' },
    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Black_hole' } },
  },
  image: {
    title: 'File:Andromeda galaxy.jpg',
    thumbnail: { source: 'https://upload.wikimedia.org/andromeda-320.jpg' },
    image: { source: 'https://upload.wikimedia.org/andromeda-1280.jpg' },
    description: { text: 'The Andromeda galaxy seen from Earth' },
    artist: { text: 'Adam Evans' },
    license: { type: 'CC BY 2.0' },
    file_page: 'https://commons.wikimedia.org/wiki/File:Andromeda_galaxy.jpg',
  },
  mostread: {
    articles: [
      { title: 'Chandrayaan-3', extract: 'India’s third lunar mission.', views: 412000, thumbnail: { source: 'https://upload.wikimedia.org/ch3.jpg' } },
      { title: 'Unified Payments Interface', extract: 'India’s instant payment system.', views: 208000, thumbnail: { source: 'https://upload.wikimedia.org/upi.png' } },
    ],
  },
};

let generation = 0;

function boot() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://veridell.pages.dev/', pretendToBeVisual: true });
  const { window } = dom;

  const fetchStub = async (url) => {
    const body = String(url).includes('/feed/featured/') ? FEED : { query: { search: [] }, parse: { text: { '*': '' } } };
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };

  Object.assign(globalThis, {
    window,
    document: window.document,
    location: window.location,
    history: window.history,
    navigator: window.navigator,
    DOMParser: window.DOMParser,
    Node: window.Node,
    HTMLElement: window.HTMLElement,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    fetch: fetchStub,
    scrollTo: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  window.scrollTo = () => {};
  window.fetch = fetchStub;
  return { window };
}

const tick = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

/* Each test needs its own page. A module is evaluated once per process, so the
 * router is imported with a unique query string every time — otherwise the
 * second test inspects a fresh document that nothing ever rendered into. */
async function render() {
  const booted = boot();
  await import(`${pathToFileURL(join(ROOT, 'src/main.js')).href}?gen=${++generation}`);
  await tick();
  return booted;
}

test('the front page shows the article of the day, with its picture', async () => {
  const { window } = await render();

  const doc = window.document;
  const card = doc.querySelector('.em-aotd');
  assert.ok(card, 'the article of the day card is on the page');
  assert.match(card.textContent, /Article of the day/i);
  assert.match(card.textContent, /Black hole/);
  assert.equal(card.querySelector('img')?.getAttribute('src'), FEED.tfa.thumbnail.source);
});

test('the front page shows the picture of the day, with its credit', async () => {
  const { window } = await render();
  const doc = window.document;
  const figure = doc.querySelector('.em-potd');
  assert.ok(figure, 'the picture of the day is on the page');
  assert.match(figure.textContent, /Picture of the day/i);
  assert.equal(figure.querySelector('img')?.getAttribute('src'), FEED.image.image.source);
  assert.match(figure.textContent, /Adam Evans/);
});

test('the most-read list carries a thumbnail for each article', async () => {
  const { window } = await render();
  const doc = window.document;
  const rows = [...doc.querySelectorAll('.em-read')];
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /Chandrayaan-3/);
  assert.equal(rows[0].querySelector('.em-read-thumb')?.getAttribute('src'), FEED.mostread.articles[0].thumbnail.source);
  assert.match(rows[0].textContent, /412k reads/);
});

test('a feed that never arrives leaves the page standing', async () => {
  const { window } = await render();
  window.fetch = async () => { throw new Error('offline'); };
  globalThis.fetch = window.fetch;
  window.location.hash = '#/sources';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  await tick();
  assert.ok(window.document.querySelector('.em-page'), 'the route still paints without a feed');
});
