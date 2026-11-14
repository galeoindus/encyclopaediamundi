/* The Wikimedia client: search, article text, summaries, on-this-day, pageviews.
 *
 * The public APIs send permissive CORS headers, so the browser reads them
 * directly. No key, no proxy, no server of ours in the path — which is also
 * why the site works when the AI endpoint is down.
 */

const API = (lang) => `https://${lang}.wikipedia.org/w/api.php`;
const REST = (lang) => `https://${lang}.wikipedia.org/api/rest_v1`;

const memo = new Map(); // url -> { at, value }

async function getJSON(url, { ttl = 5 * 60e3, signal } = {}) {
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.value;

  const response = await fetch(url, { signal, headers: { accept: 'application/json' }, credentials: 'omit' });
  if (!response.ok) throw new Error(`Wikimedia answered HTTP ${response.status}`);
  const data = await response.json();
  memo.set(url, { at: Date.now(), value: data });
  if (memo.size > 200) memo.delete(memo.keys().next().value);
  return data;
}

function qs(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/** Article titles that match a question, best first. */
export async function searchTitles(query, lang = 'en', limit = 6, signal) {
  const url = `${API(lang)}?${qs({
    action: 'query', format: 'json', origin: '*', list: 'search',
    srsearch: query, srlimit: limit, srprop: 'snippet|wordcount',
  })}`;
  const data = await getJSON(url, { signal });
  return (data?.query?.search || [])
    .map((row) => ({
      title: String(row.title || ''),
      snippet: String(row.snippet || '').replace(/<[^>]+>/g, ''),
      words: Number(row.wordcount) || 0,
    }))
    .filter((row) => row.title);
}

/** The full wikitext-free HTML of one article, plus its sections. */
export async function fetchArticle(title, lang = 'en', signal) {
  const url = `${API(lang)}?${qs({
    action: 'parse', format: 'json', origin: '*', page: title,
    prop: 'text|sections|displaytitle|revid', redirects: 1, disableeditsection: 1,
  })}`;
  const data = await getJSON(url, { signal, ttl: 30 * 60e3 });
  const parse = data?.parse;
  if (!parse?.text?.['*']) throw new Error('That article could not be read.');
  return {
    title: String(parse.title || title),
    displayTitle: String(parse.displaytitle || parse.title || title),
    html: String(parse.text['*']),
    revid: parse.revid || 0,
    sections: (parse.sections || []).map((section) => ({
      index: String(section.index),
      heading: String(section.line || ''),
      level: Number(section.toclevel) || 2,
    })),
  };
}

/** A short summary, used by the home page and by search cards. */
export async function summary(title, lang = 'en', signal) {
  const url = `${REST(lang)}/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  try {
    const data = await getJSON(url, { signal, ttl: 30 * 60e3 });
    return {
      title: String(data?.title || title),
      extract: String(data?.extract || ''),
      description: String(data?.description || ''),
      image: data?.thumbnail?.source || '',
      url: String(data?.content_urls?.desktop?.page || ''),
    };
  } catch {
    return { title, extract: '', description: '', image: '', url: '' };
  }
}

/** On this day: events, births and deaths for a date. */
export async function onThisDay(month, day, lang = 'en', signal) {
  const url = `${REST(lang)}/feed/onthisday/all/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  const data = await getJSON(url, { signal, ttl: 6 * 60 * 60e3 });
  const pick = (list) => (Array.isArray(list) ? list : []).slice(0, 6).map((item) => ({
    year: item.year || '',
    text: String(item.text || ''),
    title: String(item.pages?.[0]?.title || ''),
  }));
  return {
    events: pick(data?.events),
    births: pick(data?.births),
    deaths: pick(data?.deaths),
  };
}

/** The most-read articles yesterday — the closest thing to a front page. */
const stamp = (date) => `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;

/** The most-read articles of a day, with their thumbnail. */
export async function mostRead(lang = 'en', signal) {
  const feed = await featuredFeed(lang, signal);
  return feed.mostRead;
}

/**
 * One request for the whole front page: the article of the day, the picture of
 * the day, and what everybody read yesterday. Wikimedia publishes all of it in
 * a single feed, so the home page costs one call rather than four.
 */
export async function featuredFeed(lang = 'en', signal) {
  const url = `${REST(lang)}/feed/featured/${stamp(new Date(Date.now() - 864e5))}`;
  let data = null;
  try {
    data = await getJSON(url, { signal, ttl: 30 * 60e3 });
  } catch {
    try {
      data = await getJSON(`${REST(lang)}/feed/featured/${stamp(new Date())}`, { signal, ttl: 30 * 60e3 });
    } catch { data = null; }
  }

  const tfa = data?.tfa || null;
  const image = data?.image || null;

  const articleOfTheDay = tfa ? {
    title: String(tfa.titles?.normalized || tfa.title || ''),
    extract: String(tfa.extract || ''),
    description: String(tfa.description || ''),
    image: tfa.thumbnail?.source || tfa.originalimage?.source || '',
    url: String(tfa.content_urls?.desktop?.page || ''),
  } : null;

  const pictureOfTheDay = image ? {
    title: String(image.title || ''),
    image: image.image?.source || image.thumbnail?.source || '',
    thumb: image.thumbnail?.source || image.image?.source || '',
    caption: String(image.description?.text || image.description || ''),
    artist: String(image.artist?.text || ''),
    licence: String(image.license?.type || ''),
    url: String(image.file_page || ''),
  } : null;

  const mostReadRows = (data?.mostread?.articles || []).slice(0, 8).map((item) => ({
    title: String(item.title || ''),
    extract: String(item.extract || ''),
    views: Number(item.views) || 0,
    image: item.thumbnail?.source || '',
  }));

  return { articleOfTheDay, pictureOfTheDay, mostRead: mostReadRows };
}

/** The lead picture of one article, for the top of the answer page. */
export async function leadImage(title, lang = 'en', signal) {
  const page = await summary(title, lang, signal);
  return page.image ? { src: page.image, caption: page.description || '' } : null;
}

export const CATEGORIES = [
  { id: 'science', label: 'Science & technology', query: 'science and technology' },
  { id: 'history', label: 'History', query: 'history' },
  { id: 'space', label: 'Space & astronomy', query: 'outer space' },
  { id: 'nature', label: 'Nature & environment', query: 'natural environment' },
  { id: 'culture', label: 'Culture & society', query: 'culture' },
  { id: 'maths', label: 'Mathematics', query: 'mathematics' },
  { id: 'computing', label: 'Computing', query: 'computer science' },
  { id: 'health', label: 'Health & medicine', query: 'medicine' },
];

/* ── the rest of Wikimedia ────────────────────────────────────────────────
 * Wikipedia is one service of several, and an answer is better when the others
 * are asked too: Wikidata for the structured facts, Commons for the pictures,
 * and the language editions for the same article written by other people.
 */

/** The languages this article exists in, and its title in each. */
export async function langLinks(title, lang = 'en', signal) {
  const url = `${API(lang)}?${qs({
    action: 'query', format: 'json', origin: '*', prop: 'langlinks',
    titles: title, lllimit: 500, redirects: 1,
  })}`;
  try {
    const data = await getJSON(url, { signal, ttl: 60 * 60e3 });
    const page = Object.values(data?.query?.pages || {})[0];
    const rows = page?.langlinks || [];
    return rows.map((row) => ({ lang: String(row.lang || ''), title: String(row['*'] || '') })).filter((row) => row.lang && row.title);
  } catch { return []; }
}

/** Is there a version of this article in that language? */
export async function translatedTitle(title, lang, from = 'en', signal) {
  const links = await langLinks(title, from, signal);
  return links.find((row) => row.lang === lang)?.title || '';
}

const FACT_PROPS = [
  ['P31', 'Type'],
  ['P17', 'Country'],
  ['P571', 'Founded'],
  ['P569', 'Born'],
  ['P570', 'Died'],
  ['P108', 'Employer'],
  ['P39', 'Position'],
  ['P159', 'Headquarters'],
  ['P50', 'Author'],
  ['P279', 'Class of'],
];

function claimValue(claim) {
  const value = claim?.mainsnak?.datavalue?.value;
  if (!value) return null;
  if (typeof value === 'string') return { text: value };
  if (value.id) return { id: String(value.id) };
  if (value.time) return { text: String(value.time).replace(/^\+/, '').slice(0, 10).replace(/-00$/, '') };
  if (value.amount) return { text: String(value.amount).replace(/^\+/, '') };
  return null;
}

/** Structured facts from Wikidata, with the labels resolved to words. */
export async function wikidataFacts(title, lang = 'en', signal) {
  try {
    const propsUrl = `${API(lang)}?${qs({
      action: 'query', format: 'json', origin: '*', prop: 'pageprops',
      ppprop: 'wikibase_item', titles: title, redirects: 1,
    })}`;
    const props = await getJSON(propsUrl, { signal, ttl: 6 * 60 * 60e3 });
    const page = Object.values(props?.query?.pages || {})[0];
    const id = page?.pageprops?.wikibase_item;
    if (!id) return null;

    const entityUrl = `https://www.wikidata.org/w/api.php?${qs({
      action: 'wbgetentities', format: 'json', origin: '*', ids: id,
      props: 'claims|descriptions|labels', languages: lang === 'en' ? 'en' : `${lang}|en`,
    })}`;
    const entity = (await getJSON(entityUrl, { signal, ttl: 6 * 60 * 60e3 }))?.entities?.[id];
    if (!entity) return null;

    const rows = [];
    const needLabels = new Set();
    for (const [prop, label] of FACT_PROPS) {
      const claim = (entity.claims?.[prop] || [])[0];
      const value = claimValue(claim);
      if (!value) continue;
      if (value.id) needLabels.add(value.id);
      rows.push({ label, value });
      if (rows.length >= 6) break;
    }

    let labels = new Map();
    if (needLabels.size) {
      const labelUrl = `https://www.wikidata.org/w/api.php?${qs({
        action: 'wbgetentities', format: 'json', origin: '*', ids: [...needLabels].join('|'),
        props: 'labels', languages: lang === 'en' ? 'en' : `${lang}|en`,
      })}`;
      const data = await getJSON(labelUrl, { signal, ttl: 6 * 60 * 60e3 });
      labels = new Map(Object.entries(data?.entities || {}).map(([key, value]) => [key, value?.labels?.en?.value || value?.labels?.[lang]?.value || key]));
    }

    return {
      id,
      url: `https://www.wikidata.org/wiki/${id}`,
      description: entity.descriptions?.en?.value || entity.descriptions?.[lang]?.value || '',
      facts: rows.map((row) => ({ label: row.label, value: row.value.id ? (labels.get(row.value.id) || row.value.id) : row.value.text })),
    };
  } catch { return null; }
}

/** Pictures used on the article, with their Commons page and licence line. */
export async function commonsImages(title, lang = 'en', signal, limit = 6) {
  try {
    const listUrl = `${API(lang)}?${qs({
      action: 'query', format: 'json', origin: '*', prop: 'images',
      titles: title, imlimit: 20, redirects: 1,
    })}`;
    const data = await getJSON(listUrl, { signal, ttl: 60 * 60e3 });
    const page = Object.values(data?.query?.pages || {})[0];
    const files = (page?.images || [])
      .map((row) => String(row.title || ''))
      .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
      .filter((file) => !/icon|logo|commons-logo|wiktionary|question_book|ambox|edit-clear|padlock/i.test(file))
      .slice(0, limit);
    if (!files.length) return [];

    const infoUrl = `${API(lang)}?${qs({
      action: 'query', format: 'json', origin: '*', prop: 'imageinfo',
      titles: files.join('|'), iiprop: 'url|extmetadata', iiurlwidth: 640,
    })}`;
    const info = await getJSON(infoUrl, { signal, ttl: 60 * 60e3 });
    return Object.values(info?.query?.pages || {}).map((row) => {
      const meta = row?.imageinfo?.[0]?.extmetadata || {};
      return {
        title: String(row.title || '').replace(/^File:/, ''),
        src: row?.imageinfo?.[0]?.thumburl || row?.imageinfo?.[0]?.url || '',
        page: String(row?.imageinfo?.[0]?.descriptionurl || ''),
        credit: String(meta?.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 90),
        licence: String(meta?.LicenseShortName?.value || '').trim(),
      };
    }).filter((image) => image.src);
  } catch { return []; }
}
