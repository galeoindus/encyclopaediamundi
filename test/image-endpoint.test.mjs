/* The image endpoint must be honest: off when there is no binding, bounded
 * when there is one, and clear about which model drew the picture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequest } from '../functions/api/image.js';

const post = (body, env = {}) => onRequestPost({
  request: new Request('https://x/api/image', { method: 'POST', body: JSON.stringify(body) }),
  env,
});

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
