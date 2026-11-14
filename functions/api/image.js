/**
 * Veridell — free image generation, on Workers AI.
 *
 * The chat can draw a picture when a reader asks for one. It uses the free
 * Workers AI text-to-image model, so it costs nothing per image beyond the
 * plan's own quota, needs no third-party key, and never sends the prompt to a
 * service the reader has not been told about.
 *
 * Three rules the endpoint keeps:
 *   · it is off unless the AI binding exists — no binding means a clear
 *     "not available here" answer, never a silent failure;
 *   · the prompt is bounded and stripped of control characters before it
 *     reaches the model;
 *   · the response says which model drew the picture, because a reader is
 *     entitled to know what made the thing they are looking at.
 */
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT = 400;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
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

export async function onRequestPost({ request, env = {} }) {
  if (!env?.AI || typeof env.AI.run !== 'function') {
    return json({
      ok: false,
      configured: false,
      message: 'Image generation is not available on this deployment yet.',
    }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, message: 'Send JSON: { "prompt": "…" }.' }, 400);
  }

  const prompt = clean(body?.prompt, MAX_PROMPT);
  if (prompt.length < 3) return json({ ok: false, message: 'Describe the picture you want.' }, 400);

  try {
    const result = await env.AI.run(MODEL, { prompt });
    // Workers AI returns either a data URL string or raw bytes depending on the
    // model version; accept both rather than assuming one shape.
    let image = '';
    if (typeof result === 'string') image = result;
    else if (result?.image) image = result.image;
    else if (result instanceof ArrayBuffer) {
      image = `data:image/png;base64,${Buffer.from(new Uint8Array(result)).toString('base64')}`;
    }
    if (!image) return json({ ok: false, message: 'The model returned no picture. Try a different description.' }, 502);
    if (!image.startsWith('data:')) image = `data:image/png;base64,${image}`;
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
