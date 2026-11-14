import test from 'node:test';
import assert from 'node:assert/strict';
import { abstractFromOpenAlex, isScholarlyQuery, searchLiveSources } from '../assets/js/live-research.js';

const originalFetch = globalThis.fetch;

test('scholarly intent is detected in English and Hindi', () => {
  assert.equal(isScholarlyQuery('latest peer-reviewed studies about air pollution'), true);
  assert.equal(isScholarlyQuery('भारत में जलवायु परिवर्तन पर शोध'), true);
  assert.equal(isScholarlyQuery('hello, how are you'), false);
});

test('OpenAlex abstract inverted indexes are restored in word order', () => {
  assert.equal(abstractFromOpenAlex({ world: [1], Hello: [0], again: [2] }), 'Hello world again');
  assert.equal(abstractFromOpenAlex(null), '');
});

test('academic searches combine keyless OpenAlex, Crossref and Wikipedia sources', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    if (parsed.hostname.endsWith('wikipedia.org')) {
      return new Response(JSON.stringify({ query: { pages: [{ title: 'Air pollution', extract: 'Air pollution is contamination of indoor or outdoor environment.', fullurl: 'https://en.wikipedia.org/wiki/Air_pollution' }] } }), { status: 200 });
    }
    if (parsed.hostname === 'api.openalex.org') {
      return new Response(JSON.stringify({ results: [{
        title: 'A study of air quality', doi: 'https://doi.org/10.1000/openalex', publication_year: 2025,
        primary_location: { source: { display_name: 'Example Journal' } },
        abstract_inverted_index: { Air: [0], quality: [1], matters: [2] }, open_access: { is_oa: true },
      }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: { items: [{
      title: ['Research on air pollution'], DOI: '10.1000/crossref',
      abstract: '<jats:p>Air pollution affects health outcomes.</jats:p>',
      'container-title': ['Journal of Public Health'], published: { 'date-parts': [[2024]] },
    }] } }), { status: 200 });
  };
  try {
    const sources = await searchLiveSources('peer-reviewed research about air pollution', 'en', 6);
    assert.equal(sources.length, 3);
    assert.deepEqual(new Set(sources.map((source) => source.sourceType)), new Set(['OpenAlex', 'Crossref', 'Wikipedia']));
    assert.ok(sources.every((source) => source.url.startsWith('https://')));
    assert.equal(calls.length, 3);
    assert.ok(calls.some((url) => url.hostname === 'api.openalex.org' && !url.searchParams.has('api_key')));
    assert.ok(calls.some((url) => url.hostname === 'api.crossref.org'));
  } finally { globalThis.fetch = originalFetch; }
});

test('research degrades gracefully when an academic source is unavailable', async () => {
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'api.openalex.org') return new Response('unavailable', { status: 503 });
    if (parsed.hostname === 'api.crossref.org') return new Response(JSON.stringify({ message: { items: [] } }), { status: 200 });
    return new Response(JSON.stringify({ query: { pages: [{ title: 'Solar energy', extract: 'Solar energy comes from the Sun.', fullurl: 'https://en.wikipedia.org/wiki/Solar_energy' }] } }), { status: 200 });
  };
  try {
    const sources = await searchLiveSources('research papers about solar energy', 'en', 6);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].sourceType, 'Wikipedia');
  } finally { globalThis.fetch = originalFetch; }
});
