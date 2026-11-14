/* The provider gate, tested against the configuration that actually ships.
 *
 * The audit's release blocker (F-01) was this: the committed Pages config is
 * `AI_PROVIDER=openrouter`, `OPENROUTER_FREE_ONLY=true`, `ENABLE_PAID_AI=false`,
 * and the OpenRouter executor refused every request in that state because it
 * demanded the paid flag. Six free keys sat unused and the reader was told the
 * assistant was unavailable.
 *
 * These tests build exactly that environment and mock the provider, so the
 * question "does a free model actually run with paid AI switched off?" is
 * answered by an assertion rather than by reading the code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { __test } from '../functions/api/ask.js';

const { runOpenRouter, paidAIEnabled, providerModeFor, isFreeModelId } = __test;

const PRODUCTION_LIKE = Object.freeze({
  AI_PROVIDER: 'openrouter',
  OPENROUTER_FREE_ONLY: 'true',
  ENABLE_PAID_AI: 'false',
  OPENROUTER_API_KEY_1: 'sk-or-v1-test-key',
});

/** Run a body with fetch replaced, and restore it whatever happens. */
async function withFetch(handler, body) {
  const real = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
  }
}

function okResponse(model) {
  return new Response(JSON.stringify({
    model,
    choices: [{ message: { content: 'A grounded answer.' } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('the shipped configuration selects OpenRouter', () => {
  assert.equal(providerModeFor(PRODUCTION_LIKE), 'openrouter');
  assert.equal(paidAIEnabled(PRODUCTION_LIKE), false);
});

test('a free model runs with paid AI switched off', async () => {
  const seen = [];
  const result = await withFetch(
    async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push(body.model);
      return okResponse(body.model);
    },
    () => runOpenRouter('What is a black hole?', [], 'detailed', PRODUCTION_LIKE),
  );

  assert.equal(result.ok, true, `expected an answer, got ${result.reason}`);
  assert.equal(result.provider, 'openrouter');
  assert.ok(isFreeModelId(result.model), `${result.model} is not a free model`);
  assert.ok(seen.every(isFreeModelId), `a paid id was sent: ${seen.join(', ')}`);
});

test('a paid model id is never sent in free-only mode', async () => {
  const seen = [];
  const result = await withFetch(
    async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push(body.model);
      return okResponse(body.model);
    },
    () => runOpenRouter('Explain photosynthesis', [], 'deep', PRODUCTION_LIKE, { model: 'openai/gpt-4o' }),
  );

  assert.equal(result.ok, true);
  assert.ok(seen.every(isFreeModelId), `a paid id reached the provider: ${seen.join(', ')}`);
  assert.ok(isFreeModelId(result.model));
});

test('with free-only off and no paid opt-in, the provider is refused', async () => {
  const env = { ...PRODUCTION_LIKE, OPENROUTER_FREE_ONLY: 'false' };
  let called = false;
  const result = await withFetch(
    async () => { called = true; return okResponse('openai/gpt-4o-mini'); },
    () => runOpenRouter('Explain photosynthesis', [], 'detailed', env),
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'paid_ai_disabled');
  assert.equal(called, false, 'the provider must not be called at all');
});

test('with free-only off and the paid opt-in, the paid path is allowed', async () => {
  const env = { ...PRODUCTION_LIKE, OPENROUTER_FREE_ONLY: 'false', ENABLE_PAID_AI: 'true' };
  const result = await withFetch(
    async (url, init) => okResponse(JSON.parse(init.body).model),
    () => runOpenRouter('Explain photosynthesis', [], 'detailed', env),
  );
  assert.equal(result.ok, true);
});

test('no keys at all is reported as not configured, not as a crash', async () => {
  const env = { AI_PROVIDER: 'openrouter', OPENROUTER_FREE_ONLY: 'true' };
  const result = await withFetch(
    async () => { throw new Error('should not be called'); },
    () => runOpenRouter('hello', [], 'quick', env),
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_configured');
});

test('a provider failure is reported after every free route is tried', async () => {
  let calls = 0;
  const result = await withFetch(
    async () => { calls += 1; return new Response('nope', { status: 500 }); },
    () => runOpenRouter('Explain photosynthesis', [], 'quick', PRODUCTION_LIKE),
  );
  assert.equal(result.ok, false);
  assert.ok(calls > 0, 'at least one attempt must be made');
  assert.notEqual(result.reason, 'paid_ai_disabled');
});
