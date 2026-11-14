/**
 * Optional natural English read-aloud for Amigo.
 *
 * Browser speech remains the default and stays on-device. This opt-in endpoint
 * uses the site's Cloudflare Workers AI binding with Deepgram Aura-2 English.
 * The request is same-origin only, bounded to 1,200 characters and rate-limited.
 * Hindi and other Indic languages are deliberately not routed to an English
 * model; the client uses the reader's available device voice instead.
 */
const MODEL = '@cf/deepgram/aura-2-en';
const MAX_TEXT_CHARS = 1_200;
const MAX_BODY_BYTES = 8_192;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const buckets = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return origin === new URL(request.url).origin; }
  catch { return false; }
}

function limited(request) {
  const now = Date.now();
  const ip = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'anonymous';
  let entry = buckets.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(ip, entry);
  }
  if (entry.count >= RATE_MAX) return true;
  entry.count += 1;
  if (buckets.size > 2_000) {
    for (const [key, value] of buckets) if (now >= value.resetAt) buckets.delete(key);
  }
  return false;
}

function plainText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\[(\d{1,2})\]/g, '')
    .replace(/(?:^|\s)#{1,6}\s/g, ' ')
    .replace(/[*_`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function onRequestPost({ request, env = {} }) {
  if (!sameOrigin(request)) return json({ error: 'forbidden', message: 'This endpoint accepts same-site requests only.' }, 403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return json({ error: 'unsupported_media_type', message: 'Send a JSON request.' }, 415);
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'payload_too_large', message: 'The speech request is too large.' }, 413);

  let body;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large', message: 'The speech request is too large.' }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_request', message: 'Send valid JSON.' }, 400);
  }

  const language = String(body?.language || 'en').toLowerCase();
  if (language !== 'en') {
    return json({ error: 'unsupported_language', message: 'Natural cloud speech is currently English-only. Use a device voice for this language.' }, 422);
  }
  const text = plainText(body?.text);
  if (!text) return json({ error: 'bad_request', message: 'Text is required.' }, 400);
  if (text.length > MAX_TEXT_CHARS) {
    return json({ error: 'text_too_long', message: `Keep read-aloud text to ${MAX_TEXT_CHARS} characters or fewer.` }, 413);
  }
  if (limited(request)) {
    return json({ error: 'rate_limited', message: 'Natural voice is being used too frequently. Please wait a minute.' }, 429);
  }
  if (!env?.AI || typeof env.AI.run !== 'function') {
    return json({ error: 'not_configured', message: 'Natural cloud voice is not configured. Use the device voice instead.' }, 503);
  }

  try {
    const result = await env.AI.run(MODEL, {
      text,
      speaker: 'asteria',
      encoding: 'mp3',
    }, { returnRawResponse: true });

    if (result instanceof Response) {
      if (!result.ok) return json({ error: 'speech_failed', message: 'The speech service could not generate audio.' }, 502);
      return new Response(result.body, {
        status: 200,
        headers: {
          'content-type': result.headers.get('content-type') || 'audio/mpeg',
          'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    let bytes = null;
    if (result instanceof ArrayBuffer) bytes = result;
    else if (ArrayBuffer.isView(result)) bytes = result;
    else if (result?.audio instanceof ArrayBuffer || ArrayBuffer.isView(result?.audio)) bytes = result.audio;
    if (!bytes) return json({ error: 'speech_failed', message: 'The speech service returned no audio.' }, 502);
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return json({ error: 'speech_unavailable', message: 'Natural voice is temporarily unavailable. Use the device voice instead.' }, 503);
  }
}

export async function onRequest({ request, env = {} }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);
}
