/**
 * /api/translate — turn a finished answer into another language.
 *
 * The reader is on an article page in English and wants it in Hindi. Wikipedia
 * has no Hindi edition of that page, so the text is translated here instead.
 *
 * Two free services, tried in order, both called from the server so the browser
 * never has to deal with their CORS rules and no key is shipped to a reader:
 *
 *   1. Google's public translate endpoint (the one the web widget uses)
 *   2. MyMemory, as a fallback when the first is rate-limited
 *
 * The text is chunked so a long article does not exceed either service's limit,
 * and the chunks are translated in order and joined back together.
 */

const MAX_CHARS = 24000;
const CHUNK = 3500;

const LANGS = new Set(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'sa', 'fr', 'de', 'es', 'ar', 'zh', 'ja', 'ru', 'pt', 'id']);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

/** Split on paragraph boundaries so a sentence is never cut in half. */
export function chunk(text, size = CHUNK) {
  const parts = [];
  let buffer = '';
  for (const paragraph of String(text).split(/\n{2,}/)) {
    if ((buffer + paragraph).length > size && buffer) {
      parts.push(buffer.trim());
      buffer = '';
    }
    if (paragraph.length > size) {
      for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
        if ((buffer + sentence).length > size && buffer) {
          parts.push(buffer.trim());
          buffer = '';
        }
        buffer += `${sentence} `;
      }
    } else {
      buffer += `${paragraph}\n\n`;
    }
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts.filter(Boolean);
}

async function viaGoogle(text, from, to) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) return '';
  const data = await response.json().catch(() => null);
  const rows = Array.isArray(data?.[0]) ? data[0] : [];
  return rows.map((row) => (Array.isArray(row) ? row[0] : '')).filter(Boolean).join('');
}

async function viaMyMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) return '';
  const data = await response.json().catch(() => null);
  return String(data?.responseData?.translatedText || '');
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }

  const text = String(body?.text ?? '').trim().slice(0, MAX_CHARS);
  const from = String(body?.from || 'en').slice(0, 5);
  const to = String(body?.to || '').slice(0, 5);

  if (!text) return json({ error: 'bad_request', message: 'Nothing to translate.' }, 400);
  if (!LANGS.has(to)) return json({ error: 'bad_language', message: 'That language is not supported yet.' }, 400);
  if (to === from) return json({ text, provider: 'none', unchanged: true });

  const pieces = chunk(text);
  const out = [];
  let provider = '';

  for (const piece of pieces) {
    let translated = '';
    try { translated = await viaGoogle(piece, from, to); } catch { translated = ''; }
    if (translated) provider = provider || 'Google Translate';
    if (!translated) {
      try { translated = await viaMyMemory(piece, from, to); } catch { translated = ''; }
      if (translated) provider = provider || 'MyMemory';
    }
    // A chunk that neither service would translate is kept in the original:
    // half a translated article with holes in it is worse than one paragraph
    // left in English, and the badge tells the reader what happened.
    out.push(translated || piece);
  }

  return json({
    // Trimmed: a translator often returns a trailing space per chunk, and a
    // translated article should not end in one.
    text: out.join('\n\n').trim(),
    provider: provider || 'none',
    from,
    to,
    partial: out.some((piece, index) => piece === pieces[index]),
  });
}

export async function onRequestGet() {
  return json({ ok: true, languages: [...LANGS], maxChars: MAX_CHARS });
}

export async function onRequest({ request }) {
  if (request.method === 'POST') return onRequestPost({ request });
  if (request.method === 'GET') return onRequestGet();
  return json({ error: 'method_not_allowed' }, 405);
}

export const __test = { chunk };
