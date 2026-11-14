/* OpenRouter free variants: usable without a billing opt-in, and a paid id
 * must never be reachable while free-only mode is on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../functions/api/ask.js';

const {
  openRouterFreeOnly, isFreeModelId, providerModeFor, modelCatalog,
  autoModel, isAllowedModel, paidFallbackFor, FREE_OPENROUTER_MODELS,
} = __test;

const KEYS = { OPENROUTER_API_KEY_1: 'k1' };

test('free-only is the default', () => {
  assert.equal(openRouterFreeOnly({}), true);
  assert.equal(openRouterFreeOnly({ OPENROUTER_FREE_ONLY: 'true' }), true);
  assert.equal(openRouterFreeOnly({ OPENROUTER_FREE_ONLY: 'false' }), false);
});

test('only :free ids count as free', () => {
  assert.equal(isFreeModelId('meta-llama/llama-3.3-70b-instruct:free'), true);
  assert.equal(isFreeModelId('meta-llama/llama-3.3-70b-instruct'), false);
  assert.equal(isFreeModelId('openai/gpt-4o-mini'), false);
  assert.equal(isFreeModelId(''), false);
});

test('choosing OpenRouter is enough to run free models, without the paid flag', () => {
  assert.equal(providerModeFor({ ...KEYS, AI_PROVIDER: 'openrouter' }), 'openrouter');
  assert.equal(providerModeFor({ ...KEYS, AI_PROVIDER: 'openrouter', ENABLE_PAID_AI: 'false' }), 'openrouter');
  // A paid-only deployment still needs the explicit opt-in.
  assert.equal(providerModeFor({ ...KEYS, AI_PROVIDER: 'openrouter', OPENROUTER_FREE_ONLY: 'false' }), 'workers-ai');
  assert.equal(providerModeFor({ ...KEYS, AI_PROVIDER: 'openrouter', OPENROUTER_FREE_ONLY: 'false', ENABLE_PAID_AI: 'true' }), 'openrouter');
});

test('free-only never falls back onto a paid model', () => {
  assert.equal(paidFallbackFor({ AI_PROVIDER: 'openrouter', ENABLE_PAID_AI: 'true', ALLOW_PAID_FALLBACK: 'true' }), false);
});

test('the catalogue is free ids only in free-only mode', () => {
  const env = { ...KEYS, AI_PROVIDER: 'openrouter' };
  const menu = modelCatalog(env);
  assert.ok(menu.length >= 3);
  for (const entry of menu) assert.match(entry.id, /:free$/, entry.id);
  // The paid catalogue is not reachable.
  assert.equal(isAllowedModel(env, 'openai/gpt-4o-mini'), false);
  assert.equal(isAllowedModel(env, 'anthropic/claude-3.5-sonnet'), false);
});

test('an operator allowlist cannot smuggle a paid id into free-only mode', () => {
  const env = { ...KEYS, AI_PROVIDER: 'openrouter', OPENROUTER_MODELS: 'openai/gpt-4o-mini,meta-llama/llama-3.3-70b-instruct:free' };
  const menu = modelCatalog(env);
  assert.deepEqual(menu.map((m) => m.id), ['meta-llama/llama-3.3-70b-instruct:free']);
  assert.equal(isAllowedModel(env, 'openai/gpt-4o-mini'), false);
});

test('Auto always picks a free model in free-only mode', () => {
  const env = { ...KEYS, AI_PROVIDER: 'openrouter' };
  for (const depth of ['quick', 'detailed', 'deep']) {
    assert.match(autoModel(env, depth), /:free$/, depth);
  }
});

test('the curated free list is a real list of free ids', () => {
  assert.ok(FREE_OPENROUTER_MODELS.length >= 3);
  const ids = FREE_OPENROUTER_MODELS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of FREE_OPENROUTER_MODELS) {
    assert.match(entry.id, /:free$/);
    assert.ok(entry.label && entry.note, entry.id);
    assert.equal(entry.free, true);
  }
});

test('a free id the live catalogue publishes is picked up even if unlisted here', () => {
  const env = { ...KEYS, AI_PROVIDER: 'openrouter' };
  const live = ['some-new-model:free', 'openai/gpt-4o-mini', 'another/free-one:free'];
  const menu = modelCatalog(env, live);
  const ids = menu.map((m) => m.id);
  assert.ok(ids.includes('some-new-model:free'), ids.join(','));
  assert.ok(ids.includes('another/free-one:free'));
  assert.equal(ids.includes('openai/gpt-4o-mini'), false);
});

test('free-only never falls back to a paid default when the live catalogue has no free id', () => {
  const env = { ...KEYS, AI_PROVIDER: 'openrouter' };
  // Free variants rotate, so a catalogue that lists none today does not empty
  // the menu: a curated free id is still offered, and a request for a paid one
  // can never come out of Auto.
  const auto = autoModel(env, 'detailed', ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet']);
  assert.match(auto, /:free$/, auto);
  assert.equal(auto === 'openai/gpt-4o-mini', false);
  assert.equal(auto === 'anthropic/claude-3.5-sonnet', false);
});

test('the paid catalogue still has its default when free-only is off', () => {
  const env = { ...KEYS, AI_PROVIDER: 'openrouter', OPENROUTER_FREE_ONLY: 'false', ENABLE_PAID_AI: 'true' };
  assert.equal(autoModel(env, 'detailed', ['openai/gpt-4o-mini']), 'openai/gpt-4o-mini');
});
