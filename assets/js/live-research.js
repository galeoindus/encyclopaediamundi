/** Free, keyless live research sources. No paid search API or account is used. */
const clean = (value, max = 1_800) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, max);

function wikiUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && (url.hostname === 'wikipedia.org' || url.hostname.endsWith('.wikipedia.org')) ? url.href : '';
  } catch { return ''; }
}

function wikiImageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && (url.hostname === 'upload.wikimedia.org' || url.hostname === 'commons.wikimedia.org') ? url.href : '';
  } catch { return ''; }
}

function doiUrl(value) {
  const doi = String(value || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').trim();
  if (!doi || doi.length > 300 || /[\s<>"']/u.test(doi)) return '';
  return `https://doi.org/${encodeURIComponent(doi).replace(/%2F/gi, '/')}`;
}

export function isScholarlyQuery(query) {
  return /\b(studies|study|research|paper|papers|journal|scientific|peer.?review|literature|meta.analysis|systematic review|clinical trial|evidence|academic|publication|publications)\b|शोध|अध्ययन|रिसर्च|वैज्ञानिक/i.test(String(query || ''));
}

export function abstractFromOpenAlex(index) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      const number = Number(pos);
      if (Number.isInteger(number) && number >= 0 && number < 20_000) words[number] = word;
    }
  }
  return clean(words.filter(Boolean).join(' '), 1_600);
}

async function requestJson(url, signal) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Research source HTTP ${response.status}`);
  return response.json();
}

async function searchWikipedia(query, language, limit, signal) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  const params = {
    action: 'query', format: 'json', formatversion: '2', origin: '*',
    generator: 'search', gsrsearch: query, gsrlimit: String(limit),
    prop: 'extracts|info|pageimages|description', inprop: 'url', exintro: '1', explaintext: '1',
    exchars: '1800', piprop: 'thumbnail', pithumbsize: '480', redirects: '1',
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const data = await requestJson(url.href, signal);
  const pages = data?.query?.pages;
  const list = Array.isArray(pages) ? pages : (pages ? Object.values(pages) : []);
  return list.filter((page) => page && !page.missing && page.extract).map((page) => ({
    title: clean(page.title, 200),
    text: clean(page.extract, 1_800),
    description: clean(page.description || '', 260),
    image: wikiImageUrl(page.thumbnail?.source),
    sourceType: 'Wikipedia',
    url: wikiUrl(page.fullurl) || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`,
  })).filter((page) => page.title && page.text && page.url);
}

async function searchCrossref(query, signal) {
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query', String(query || '').slice(0, 300));
  url.searchParams.set('rows', '3');
  url.searchParams.set('select', 'title,published,created,DOI,container-title,abstract,type');
  const data = await requestJson(url.href, signal);
  const items = Array.isArray(data?.message?.items) ? data.message.items : [];
  return items.map((item) => {
    const title = clean(item?.title?.[0], 200);
    const doi = doiUrl(item?.DOI);
    const abstract = clean(String(item?.abstract || '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), 1_600);
    if (!title || !doi || !abstract) return null;
    const date = item?.published?.['date-parts']?.[0] || item?.created?.['date-parts']?.[0] || [];
    const year = date[0] ? String(date[0]) : '';
    const journal = clean(item?.['container-title']?.[0], 120);
    return { title, text: abstract, description: [journal, year].filter(Boolean).join(' · '), image: '', sourceType: 'Crossref', url: doi };
  }).filter(Boolean);
}

async function searchOpenAlex(query, signal) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', String(query || '').slice(0, 300));
  url.searchParams.set('per-page', '3');
  url.searchParams.set('select', 'id,doi,title,publication_year,primary_location,abstract_inverted_index,type,open_access');
  const data = await requestJson(url.href, signal);
  const items = Array.isArray(data?.results) ? data.results : [];
  return items.map((item) => {
    const title = clean(item?.title, 200);
    const abstract = abstractFromOpenAlex(item?.abstract_inverted_index);
    const doi = doiUrl(item?.doi);
    const id = String(item?.id || '');
    const fallback = /^https:\/\/openalex\.org\/W\d+$/i.test(id) ? id : '';
    const urlValue = doi || fallback;
    if (!title || !abstract || !urlValue) return null;
    const journal = clean(item?.primary_location?.source?.display_name, 120);
    const year = item?.publication_year ? String(item.publication_year) : '';
    const access = item?.open_access?.is_oa === true ? 'Open access' : '';
    return {
      title,
      text: abstract,
      description: [journal, year, access].filter(Boolean).join(' · '),
      image: '',
      sourceType: 'OpenAlex',
      url: urlValue,
    };
  }).filter(Boolean);
}

/**
 * Search the Wikimedia knowledge base for every query. Academic phrases also
 * search OpenAlex and Crossref in parallel; use at most six compact source
 * passages in the answer request. Public search queries are sent to these APIs.
 */
export async function searchLiveSources(query, language = 'en', limit = 6, signal) {
  const scholarly = isScholarlyQuery(query);
  const wikiCount = scholarly ? 3 : Math.min(6, Math.max(2, limit));
  const results = await Promise.allSettled([
    searchWikipedia(query, language, wikiCount, signal),
    ...(scholarly ? [searchOpenAlex(query, signal), searchCrossref(query, signal)] : []),
  ]);
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const wiki = results[0].status === 'fulfilled' ? results[0].value : [];
  const academic = results.slice(1).filter((result) => result.status === 'fulfilled').flatMap((result) => result.value);
  if (!wiki.length && !academic.length) {
    const error = results.find((result) => result.status === 'rejected')?.reason;
    throw error || new Error('No research sources responded.');
  }
  const preferred = scholarly ? [...academic.slice(0, 4), ...wiki] : wiki;
  const unique = [];
  const seen = new Set();
  for (const item of preferred) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= 6) break;
  }
  return unique;
}
