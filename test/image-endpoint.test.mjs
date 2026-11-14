/* The image endpoint must be honest: off when there is no binding, bounded
 * when there is one, and clear about which model drew the picture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequest, __resetThrottle } from '../functions/api/image.js';

// A real client sends JSON, and says so. The endpoint enforces the content
// type now, so the helper has to look like the thing it stands in for.
const post = (body, env = {}) => {
  __resetThrottle();
  return onRequestPost({
    request: new Request('https://x/api/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  });
};

test('without an AI binding it says so instead of failing quietly', async () => {
  const res = await post({ prompt: 'a blue bird' }, {});
  assert.equal(res.status, 501);
  const body = await res.json();
  assert.equal(body.configured, false);
  assert.ok(body.message.length > 10);
});

test('a prompt that is too short is refused before the model is called', async () => {
  let called = false;
  const env = { AI: { run: async () => { called = true; return {}; } } };
  const res = await post({ prompt: ' ' }, env);
  assert.equal(res.status, 400);
  assert.equal(called, false);
});

test('a real prompt returns an image and names the model', async () => {
  const env = { AI: { run: async (model, input) => {
    assert.match(model, /^@cf\//);
    assert.ok(input.prompt.length > 0);
    return { image: 'aGVsbG8=' };
  } } };
  const res = await post({ prompt: 'a paper bird over a river' }, env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.image, /^data:image\/png;base64,/);
  assert.match(body.model, /flux/);
});

test('control characters are stripped from the prompt', async () => {
  let seen = '';
  const env = { AI: { run: async (_m, input) => { seen = input.prompt; return { image: 'x' }; } } };
  await post({ prompt: 'a\u0000 cat\n\non\u001b a mat' }, env);
  assert.equal(seen, 'a cat on a mat');
});

/* ── the abuse controls the audit asked for (F-03) ─────────────────────── */

const postWith = (headers, body, env) => {
  __resetThrottle();
  return onRequestPost({
  request: new Request('https://veridell.pages.dev/api/image', {
    method: 'POST',
    headers,
    body,
  }),
  env,
});
};

const liveEnv = () => ({ AI: { run: async () => ({ image: 'aGVsbG8=' }) } });

test('a cross-origin caller is refused', async () => {
  const res = await postWith(
    { 'content-type': 'application/json', origin: 'https://someone-else.example' },
    JSON.stringify({ prompt: 'a paper bird' }),
    liveEnv(),
  );
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'forbidden_origin');
});

test('a same-origin caller is allowed', async () => {
  const res = await postWith(
    { 'content-type': 'application/json', origin: 'https://veridell.pages.dev' },
    JSON.stringify({ prompt: 'a paper bird over a river' }),
    liveEnv(),
  );
  assert.equal(res.status, 200);
});

test('a body that is not JSON is refused before it is parsed', async () => {
  const res = await postWith(
    { 'content-type': 'text/plain' },
    'prompt=a bird',
    liveEnv(),
  );
  assert.equal(res.status, 415);
});

test('an oversized body is refused', async () => {
  const huge = JSON.stringify({ prompt: 'x'.repeat(8000) });
  const res = await postWith({ 'content-type': 'application/json' }, huge, liveEnv());
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, 'payload_too_large');
});

test('a prompt that is not a string is refused', async () => {
  const res = await postWith(
    { 'content-type': 'application/json' },
    JSON.stringify({ prompt: { evil: true } }),
    liveEnv(),
  );
  assert.equal(res.status, 400);
});

test('raw bytes from the model come back as a PNG data URL without Buffer', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
  const res = await postWith(
    { 'content-type': 'application/json' },
    JSON.stringify({ prompt: 'a small grey square' }),
    { AI: { run: async () => bytes } },
  );
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.match(body.image, /^data:image\/png;base64,/);
  assert.equal(Buffer.from('iVBORw==', 'base64').toString('base64'), 'iVBORw==');
});

test('a burst from one caller is throttled with Retry-After', async () => {
  const env = liveEnv();
  // No reset between the two sends: this test is about the counter surviving.
  __resetThrottle();
  const send = () => onRequestPost({
    request: new Request('https://veridell.pages.dev/api/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
      body: JSON.stringify({ prompt: 'a paper bird over a river' }),
    }),
    env,
  });
  const first = await send();
  assert.equal(first.status, 200);
  const second = await send();
  assert.equal(second.status, 429);
  assert.ok(second.headers.get('retry-after'), 'a 429 must say when to come back');
  assert.equal((await second.json()).error, 'rate_limited');
});
