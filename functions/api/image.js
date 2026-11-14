/**
 * Veridell — free image generation, on Workers AI.
 *
 * The chat can draw a picture when a reader asks for one. It uses the free
 * Workers AI text-to-image model, so it costs nothing per image beyond the
 * plan's own quota, needs no third-party key, and never sends the prompt to a
 * service the reader has not been told about.
 *
 * What the endpoint refuses, and why:
 *
 *   · a request from another origin — the endpoint exists for this site's own
 *     composer, and a cross-origin call is somebody using the deployment's
 *     quota from their own page;
 *   · a body that is not JSON, or is larger than a prompt could need — the
 *     body is read with a byte ceiling, so an oversized upload is dropped
 *     before it is parsed rather than after it is in memory;
 *   · a prompt shorter than three characters, or longer than the model will
 *     read;
 *   · more than a handful of images per minute from one caller, or more than
 *     the day's allowance overall — both answer 429 with `Retry-After`.
 *
 * The per-caller counter is per worker isolate, so it is a fast guard rather
 * than a global limit; the day counter is the same. Put Cloudflare WAF rate
 * limiting in front of this route if the deployment is ever worth abusing.
 */
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT = 400;
const MAX_BODY_BYTES = 4 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/* One image every eight seconds per caller, twenty-five in a rolling minute,
   and a hard ceiling on the day for the whole deployment. */
const PER_CALLER_MS = 8_000;
const PER_CALLER_MINUTE = 25;
const DAILY_LIMIT = 300;

const callerHits = new Map(); // ip -> { minute: [timestamps], last: ms }
let day = { key: '', count: 0 };

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

function clean(text, max) {
  return String(text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Today, in UTC, as a key the daily counter can be reset against. */
function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** The caller's address, as far as Cloudflare will tell us. Never stored. */
function callerId(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * Refuse a caller that is asking too often.
 *
 * Returns null when the request may proceed, or a ready-made 429 response.
 * Nothing about the caller is kept beyond the timestamps in this isolate's
 * memory, and the map is pruned as it is read.
 */
function throttle(request) {
  const now = Date.now();
  const key = callerId(request);

  const today = dayKey();
  if (day.key !== today) day = { key: today, count: 0 };
  if (day.count >= DAILY_LIMIT) {
    return json(
      { ok: false, error: 'daily_quota_reached', message: 'The daily image allowance for this site is used up. Try again tomorrow.' },
      429,
      { 'retry-after': '3600' },
    );
  }

  const entry = callerHits.get(key) || { minute: [], last: 0 };
  entry.minute = entry.minute.filter((at) => now - at < 60_000);
  if (entry.last && now - entry.last < PER_CALLER_MS) {
    callerHits.set(key, entry);
    const wait = Math.ceil((PER_CALLER_MS - (now - entry.last)) / 1000) || 1;
    return json(
      { ok: false, error: 'rate_limited', message: 'One picture at a time — give it a few seconds.' },
      429,
      { 'retry-after': String(wait) },
    );
  }
  if (entry.minute.length >= PER_CALLER_MINUTE) {
    callerHits.set(key, entry);
    return json(
      { ok: false, error: 'rate_limited', message: 'That is a lot of pictures in a minute. Try again shortly.' },
      429,
      { 'retry-after': '60' },
    );
  }

  entry.minute.push(now);
  entry.last = now;
  callerHits.set(key, entry);
  day.count += 1;

  // Keep the map from growing without bound on a long-lived isolate.
  if (callerHits.size > 500) {
    for (const [k, v] of callerHits) {
      if (!v.minute.length || now - v.last > 300_000) callerHits.delete(k);
    }
  }
  return null;
}

/** Read a request body with a byte ceiling, before it is ever parsed. */
async function readJsonLimited(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared && declared > maxBytes) return { tooLarge: true };
  if (!request.body) return { text: '' };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes) };
}

/**
 * Base64 without Node's Buffer.
 *
 * Pages Functions run on the Workers runtime; `Buffer` is only there when the
 * compatibility flag is on, and relying on it silently is how an endpoint
 * works locally and fails in production.
 */
function toBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** A same-origin browser request, or one with no Origin at all (curl, tests). */
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Test-only: clear the in-isolate counters so each case starts from zero. */
export function __resetThrottle() {
  callerHits.clear();
  day = { key: '', count: 0 };
}

export async function onRequestPost({ request, env = {} }) {
  if (!env?.AI || typeof env.AI.run !== 'function') {
    return json({
      ok: false,
      configured: false,
      message: 'Image generation is not available on this deployment yet.',
    }, 501);
  }

  if (!sameOrigin(request)) {
    return json({ ok: false, error: 'forbidden_origin', message: 'This endpoint answers only this site.' }, 403);
  }

  const type = String(request.headers.get('content-type') || '').toLowerCase();
  if (!type.includes('application/json')) {
    return json({ ok: false, error: 'unsupported_media_type', message: 'Send application/json.' }, 415);
  }

  const limited = await readJsonLimited(request, MAX_BODY_BYTES);
  if (limited.tooLarge) {
    return json({ ok: false, error: 'payload_too_large', message: 'That request is too large.' }, 413);
  }

  let body;
  try {
    body = JSON.parse(limited.text || '{}');
  } catch {
    return json({ ok: false, message: 'Send JSON: { "prompt": "…" }.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, message: 'Send JSON: { "prompt": "…" }.' }, 400);
  }
  if (typeof body.prompt !== 'string') {
    return json({ ok: false, message: 'Send JSON: { "prompt": "…" }.' }, 400);
  }

  const prompt = clean(body.prompt, MAX_PROMPT);
  if (prompt.length < 3) return json({ ok: false, message: 'Describe the picture you want.' }, 400);

  const blocked = throttle(request);
  if (blocked) return blocked;

  try {
    const result = await env.AI.run(MODEL, { prompt });
    // Workers AI returns either a data URL string or raw bytes depending on the
    // model version; accept both rather than assuming one shape.
    let image = '';
    if (typeof result === 'string') image = result;
    else if (result?.image) image = result.image;
    else if (result instanceof ArrayBuffer) {
      if (result.byteLength > MAX_IMAGE_BYTES) {
        return json({ ok: false, message: 'The picture came back too large to send.' }, 502);
      }
      image = `data:image/png;base64,${toBase64(new Uint8Array(result))}`;
    } else if (ArrayBuffer.isView(result)) {
      if (result.byteLength > MAX_IMAGE_BYTES) {
        return json({ ok: false, message: 'The picture came back too large to send.' }, 502);
      }
      image = `data:image/png;base64,${toBase64(new Uint8Array(result.buffer, result.byteOffset, result.byteLength))}`;
    }
    if (!image) return json({ ok: false, message: 'The model returned no picture. Try a different description.' }, 502);
    // Only ever hand back an image data URL, never an arbitrary scheme.
    if (!image.startsWith('data:image/')) image = `data:image/png;base64,${image}`;
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(image)) {
      return json({ ok: false, message: 'The model returned something that is not an image.' }, 502);
    }
    return json({ ok: true, image, model: MODEL, prompt });
  } catch {
    return json({ ok: false, message: 'Image generation failed. Try again in a moment.' }, 502);
  }
}

export async function onRequest({ request, env = {} }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'GET' || request.method === 'HEAD') {
    return json({ ok: true, model: MODEL, configured: Boolean(env?.AI && typeof env.AI.run === 'function') });
  }
  return json({ ok: false, message: 'Use POST.' }, 405);
}
