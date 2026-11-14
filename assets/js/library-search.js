/* Veridell — the site's own library, searched first.
 *
 * The chat used to go straight to the network for every question, so a reader
 * asking about a subject the site has already written up got a short generated
 * answer instead of the article that sits two clicks away. That is backwards:
 * the written articles are the product, and they are grounded, dated and
 * citable.
 *
 * So every question is checked against assets/data/library.json — generated
 * from the article pages themselves by scripts/gen-library.mjs — before any
 * model is called. A clear match is answered from the article's own words and
 * links to it. A near miss still hands the article text to the model as the
 * first passage, so the answer stays anchored to what we published.
 */

const LIBRARY_URL = '/assets/data/library.json';

/**
 * Make an encyclopaedia sentence readable.
 * The leads carry IPA in slashes, citation markers in brackets and a space
 * before every comma — "Ashoka , also known as Asoka ( / ə ˈ ʃ oʊ k ə / [1] …"
 * is technically correct and unpleasant to read, and it was the first thing a
 * reader saw in the answer.
 */
export function tidy(text) {
  let out = String(text || '');
  // citation markers first, so they cannot split a parenthetical group
  out = out.replace(/\[[0-9]{1,3}\]/g, '');
  // any parenthetical that carries phonetics: slashes, IPA letters or a
  // romanisation tag. Those groups are what made the first line of an answer
  // read like a dictionary entry.
  out = out.replace(/\([^()]{0,240}\)/g, (group) => {
    const ipa = /[\/ˈˌəɐʃʊɪɔɛŋθðʒːˑ]|Sanskrit|IAST|romanis|pronounced|listen/i.test(group);
    return ipa ? ' ' : group;
  });
  // a bare romanisation tail such as "; Sanskrit: [ɐˈɕoːkɐ]"
  out = out.replace(/;?\s*(Sanskrit|IAST|ISO|romanised|romanized)\s*:[^.;]*/gi, '');
  return out
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.]+/, '')
    .trim();
}

let cache = null;
let loading = null;

/** Words that carry no signal in a question. */
const STOP = new Set(('a an the is are was were be been being of in on at to for from by with about into over after '
  + 'before and or but if then than that this these those it its as who what when where why how which whom whose '
  + 'tell me please explain describe give show know does do did can could would should i you we they he she his her '
  + 'their our my your there here also just very more most some any all not no yes').split(' '));

function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** A tiny stemmer: enough to make "ruled", "ruling" and "rules" one term. */
function stem(word) {
  return word
    .replace(/(ies)$/, 'y')
    .replace(/(sses|shes|ches|xes)$/, 's')
    .replace(/(ing|ed|es|s)$/, '')
    .replace(/(ly|ment|ness|tion)$/, '');
}

/** Tokens with stemming applied, for the index and the query alike. */
function indexTokens(text) {
  return tokens(text).map(stem);
}

/**
 * BM25 over the article sections.
 *
 * The first version counted how many of the question's words appeared in a
 * section, which cannot tell "the king ruled for forty years" from "the word
 * king appears once". BM25 fixes the two things that matter: a term that is
 * rare across the library is worth more than a common one, and a long section
 * does not win just for being long. It needs no model, no network and no key,
 * so it works on a static page — and it is a genuine ranking function rather
 * than a heuristic.
 */
const K1 = 1.4;
const B = 0.72;

function buildIndex(items) {
  const docs = [];
  for (const item of items) {
    const sections = item.sections?.length ? item.sections : [{ h: item.title, p: item.lead || item.summary || '' }];
    sections.forEach((section, i) => {
      const body = `${section.h || ''} ${section.p || ''}`;
      const terms = indexTokens(body);
      docs.push({
        item, section, position: i,
        terms,
        counts: terms.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map()),
        length: terms.length,
        titleTerms: new Set(indexTokens(item.title || '')),
      });
    });
  }
  const df = new Map();
  for (const doc of docs) for (const t of doc.counts.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avg = docs.reduce((n, d) => n + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avg, total: docs.length };
}

let index = null;

/* ── the local copy ───────────────────────────────────────────────────────
 * The library is 72 KB of JSON that changes only when an article changes, and
 * every chat visit fetched it again. It is now kept in IndexedDB: the second
 * visit answers instantly from the local copy while a fresh copy is fetched in
 * the background, and if the network is gone the cached copy still works.
 * Storage is per browser and never leaves the device, like the rest of the
 * chat's state.
 */
const DB_NAME = 'Veridell';
const DB_STORE = 'cache';
const LIBRARY_KEY = 'library';
const LIBRARY_TTL_MS = 12 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexeddb')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb failed'));
  });
}

async function readCache() {
  try {
    const db = await openDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const get = tx.objectStore(DB_STORE).get(LIBRARY_KEY);
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    db.close();
    if (!row || !Array.isArray(row.items) || !row.items.length) return null;
    return row;
  } catch { return null; }
}

async function writeCache(items) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put({ items, savedAt: Date.now() }, LIBRARY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* private mode, quota, no indexeddb: the fetch path still works */ }
}

/** Load once, never let a failed fetch break the chat, and use the local copy. */
export async function loadLibrary(signal) {
  if (cache) return cache;
  if (loading) return loading;

  loading = (async () => {
    const stored = await readCache();
    if (stored) {
      cache = stored.items;
      index = buildIndex(cache);
      // refresh in the background; a stale copy is still a working copy
      if (Date.now() - stored.savedAt > LIBRARY_TTL_MS) refresh(signal);
      return cache;
    }
    const fresh = await fetchLibrary(signal);
    if (fresh.length) return fresh;
    cache = [];
    index = null;
    return cache;
  })().finally(() => { loading = null; });

  return loading;
}

async function fetchLibrary(signal) {
  try {
    const res = await fetch(LIBRARY_URL, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) return [];
    cache = items;
    index = buildIndex(items);
    writeCache(items);
    return items;
  } catch {
    return cache || [];
  }
}

/** Background refresh: never awaited by the caller, never throws. */
function refresh(signal) {
  fetchLibrary(signal).catch(() => {});
}

/** BM25 score of one section against the query terms. */
function bm25(doc, qTerms, idx) {
  let score = 0;
  for (const term of qTerms) {
    const f = doc.counts.get(term) || 0;
    if (!f) continue;
    const df = idx.df.get(term) || 0;
    const idf = Math.log(1 + (idx.total - df + 0.5) / (df + 0.5));
    const norm = f * (K1 + 1) / (f + K1 * (1 - B + B * (doc.length / idx.avg)));
    score += idf * norm;
    if (doc.titleTerms.has(term)) score += idf * 1.6;   // a subject's own name
  }
  return score;
}

/** What kind of answer the question is asking for. */
export function questionKind(question) {
  const q = String(question || '').toLowerCase();
  if (/\b(when|what year|which year|how old|date of|born|died)\b/.test(q)) return 'when';
  if (/\b(why|reason|cause|because|led to|result of)\b/.test(q)) return 'why';
  if (/\b(how (do|does|did|is|are|can)|in what way|process|work)\b/.test(q)) return 'how';
  if (/\b(who|whom|whose)\b/.test(q)) return 'who';
  if (/\b(list|name|types of|kinds of|examples of)\b/.test(q)) return 'list';
  if (/\b(where|place|located|country|region)\b/.test(q)) return 'where';
  return 'what';
}

/** Signals a section is likely to answer each kind of question. */
const KIND_HINTS = {
  when: /\b(1[0-9]{3}|20[0-9]{2}|century|year|born|died|founded|ruled|reigned)\b/i,
  why: /\b(because|therefore|so that|as a result|led to|due to|reason|to avoid|in order to)\b/i,
  how: /\b(by |through |using |process|method|works?|steps?|first|then)\b/i,
  who: /\b(was|were|is|are)\b[^.]{0,80}\b(king|emperor|ruler|scientist|writer|author|leader|founder|born)\b/i,
  list: /\b(include|such as|types|kinds|examples|consists of)\b|,/i,
  where: /\b(in|at|near|located|region|country|city|state)\b/i,
  what: /\b(is|are|was|were|refers to|known as|means)\b/i,
};

/**
 * Passages from one article, chosen for the question being asked.
 * A "when" question and a "why" question about the same subject used to
 * receive the same three sections in the same order, which read as a canned
 * answer repeated in every chat. Sections are now scored on the question's
 * own words plus the kind of answer it wants.
 */
function passagesFor(item, qTokens, question, max = 4) {
  const kind = questionKind(question);
  const hint = KIND_HINTS[kind] || KIND_HINTS.what;

  const scored = (item.sections || []).map((section, index) => {
    const text = `${section.h} ${section.p}`.toLowerCase();
    const hits = qTokens.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
    const headingHits = qTokens.reduce((n, t) => n + (section.h.toLowerCase().includes(t) ? 1 : 0), 0);
    const kindBonus = hint.test(section.p) ? 2 : 0;
    return { ...section, index, score: hits * 3 + headingHits * 4 + kindBonus };
  });

  const relevant = scored.filter((section) => section.score > 0).sort((a, b) => b.score - a.score);
  const chosen = (relevant.length ? relevant : scored).slice(0, max);
  // present them in the order the article has them, so the answer still reads
  // as a piece of writing rather than a pile of matches
  chosen.sort((a, b) => a.index - b.index);
  return chosen.map((section) => ({ heading: section.h, text: section.p, score: section.score }));
}

/**
 * Look a question up in the library.
 * Returns { item, score, strong, kind, weight, passages } or null.
 */
export async function lookup(question, { signal } = {}) {
  const items = await loadLibrary(signal);
  if (!items.length || !index) return null;
  const qTerms = [...new Set(indexTokens(question))];
  if (!qTerms.length) return null;

  // score every section, then attribute the score to its article
  const byArticle = new Map();
  for (const doc of index.docs) {
    const score = bm25(doc, qTerms, index);
    if (!score) continue;
    const entry = byArticle.get(doc.item) || { item: doc.item, total: 0, sections: [] };
    entry.total += score;
    entry.sections.push({ heading: doc.section.h, text: doc.section.p, score, position: doc.position });
    byArticle.set(doc.item, entry);
  }
  if (!byArticle.size) return null;

  const ranked = [...byArticle.values()].sort((a, b) => b.total - a.total);
  const best = ranked[0];
  // a match is strong when the question's words are genuinely present, not
  // when one common word happens to appear somewhere in a long article
  // coverage over the whole article, not only the four chosen sections —
  // measuring it against the shortlist made a well-covered question look weak
  const whole = indexTokens(`${best.item.title} ${best.item.lead || ''} ${best.item.summary || ''} `
    + (best.item.sections || []).map((section) => `${section.h} ${section.p}`).join(' '));
  const wholeSet = new Set(whole);
  const coverage = qTerms.filter((t) => wholeSet.has(t)).length / qTerms.length;
  // Strong means the question is really about this article: most of its words
  // are present, the score is substantial, and the subject's own name is in
  // the question. "Why is the sky blue" must not be answered by whichever
  // article happens to contain the word "blue" once.
  const titleHit = indexTokens(best.item.title || '').some((t) => qTerms.includes(t));
  const strong = titleHit ? best.total >= 8 : (coverage >= 0.7 && best.total >= 12);

  const passages = best.sections
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.position - b.position)
    .map((section) => ({ heading: section.heading, text: section.text, score: section.score }));

  return {
    item: best.item,
    score: Math.round(best.total * 10) / 10,
    strong,
    kind: questionKind(question),
    weight: qTerms.length,
    coverage,
    passages,
  };
}

/** The answer body, written from the article's own sentences. */
export function composeAnswer(hit, { depth = 'detailed' } = {}) {
  const { item } = hit;
  const parts = [];
  const seen = [];
  const already = (sentence) => {
    const key = sentence.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 60);
    if (!key) return true;
    if (seen.some((s) => s === key || s.includes(key) || key.includes(s))) return true;
    seen.push(key);
    return false;
  };

  // For a general "what is X" question the article's own opening is the right
  // start. For anything more specific, open with the sentence that answers it
  // — otherwise every question about a subject gets the same first paragraph.
  const lead = tidy(item.lead || item.summary || '');
  // A short "who / what is X" question wants the article's own opening —
  // that sentence was written to introduce the subject. A longer question
  // with a qualifier wants the section that answers it.
  const identity = ['who', 'what', 'where'].includes(hit.kind) && (hit.weight || 0) <= 6;
  const specific = hit.kind && !identity;
  // the best available section, not only an excellent one: falling back to
  // the article's opening for every specific question is what made two
  // different questions produce the same answer
  const best = hit.passages.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  if (lead && !specific && !already(lead)) parts.push(lead);
  else if (best) {
    const opening = tidy(best.text).split(/(?<=[.!?])\s+/).find((line) => line.length > 30);
    if (opening && !already(opening)) parts.push(opening);
  } else if (lead && !already(lead)) parts.push(lead);

  // sections in the order the article has them, not in match order: an answer
  // that hops between unrelated sections reads like a list of fragments
  const wanted = depth === 'quick' ? 2 : depth === 'deep' ? 5 : 3;
  const chosen = hit.passages
    .slice(0, wanted)
    .sort((a, b) => (item.sections || []).findIndex((x) => x.h === a.heading)
                  - (item.sections || []).findIndex((x) => x.h === b.heading));
  for (const section of chosen) {
    const heading = tidy(String(section.heading || '').replace(/^\d+\.?\s*/, ''));
    const body = tidy(section.text);
    if (!body) continue;
    // one or two clean sentences per section, not a wall of text
    const sentences = body.split(/(?<=[.!?])\s+/).filter((x) => x.length > 25).slice(0, 2).join(' ');
    if (!sentences || already(sentences)) continue;
    parts.push(heading ? `**${heading}.** ${sentences}` : sentences);
  }

  if (depth !== 'quick' && (item.facts || []).length) {
    const facts = item.facts.slice(0, 4).map((f) => `- **${f.k}:** ${f.v}`).join('\n');
    parts.push(`### Key facts\n${facts}`);
  }
  return parts.join('\n\n');
}

/** The article, shaped like a source card the chat already knows how to draw. */
export function librarySource(hit) {
  return {
    n: 1,
    title: hit.item.title,
    url: hit.item.url,
    sourceType: 'Veridell library',
    snippet: hit.item.summary || hit.item.lead || '',
    image: null,
  };
}
