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
export async function mostRead(lang = 'en', signal) {
  const date = new Date(Date.now() - 864e5);
  const stamp = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
  const url = `${REST(lang)}/feed/featured/${stamp}`;
  try {
    const data = await getJSON(url, { signal, ttl: 60 * 60e3 });
    return (data?.mostread?.articles || []).slice(0, 8).map((item) => ({
      title: String(item.title || ''),
      extract: String(item.extract || ''),
      views: Number(item.views) || 0,
      image: item.thumbnail?.source || '',
    }));
  } catch {
    return [];
  }
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
