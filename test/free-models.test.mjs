/* The free tier had no model choice at all: the menu returned early when no
 * paid models existed, and runWorkersAI handed whatever the request body named
 * straight to the provider. Both are now governed by one allowlist.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../functions/api/ask.js';

const { FREE_MODELS, freeModelAllowed, modelMenu } = __test;

test('the free catalogue is a real list, with no duplicates', () => {
  assert.ok(FREE_MODELS.length >= 3);
  const ids = FREE_MODELS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of FREE_MODELS) {
    assert.match(entry.id, /^@cf\//, 'only Workers AI ids belong here');
    assert.ok(entry.label && entry.note, `${entry.id} needs a label and a note`);
  }
});

test('only catalogue ids are allowed through', () => {
  assert.equal(freeModelAllowed(FREE_MODELS[0].id), true);
  assert.equal(freeModelAllowed('openai/gpt-4o'), false, 'a paid id is not a free model');
  assert.equal(freeModelAllowed('@cf/not-a-real-model'), false);
  assert.equal(freeModelAllowed(''), false);
  assert.equal(freeModelAllowed(undefined), false);
});

test('the menu publishes the free tier when no paid key is configured', async () => {
  const fakeAI = { run: async () => ({ response: 'ok' }) };
  const menu = await modelMenu({ AI: fakeAI });
  assert.equal(menu.paidAIEnabled, false);
  assert.equal(menu.workersAIConfigured, true);
  assert.equal(menu.models.length, 0, 'no paid models without a key');
  assert.ok(menu.freeModels.length >= 3, 'but the free models are listed');
  assert.ok(menu.autoFree, 'and there is a default to point at');
  assert.equal(menu.freeModels[0].free, true);
});

test('with no Workers AI binding there is nothing free to offer', async () => {
  const menu = await modelMenu({});
  assert.equal(menu.workersAIConfigured, false);
  assert.equal(menu.freeModels.length, 0);
  assert.equal(menu.autoFree, '');
});
