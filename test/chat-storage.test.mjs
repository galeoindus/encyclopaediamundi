import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_SESSION_BACKUP_KEY, CHAT_STORAGE_REVISION_KEY,
  readChatBackup, saveChatState,
} from '../assets/js/chat-storage.js';

function fakeStorage({ failWrites = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (failWrites) throw new Error('storage quota exceeded');
      data.set(key, String(value));
    },
    removeItem(key) { data.delete(key); },
  };
}

const state = {
  threads: [{ id: 'thread-1', q: 'Hello', messages: [{ type: 'q', text: 'Hello' }] }],
  activeThreadId: 'thread-1',
  messages: [{ type: 'q', text: 'Hello' }],
  saved: [{ question: 'Hello', answer: 'Hi' }],
};

test('chat state is stored durably and a stale session backup is removed', () => {
  const local = fakeStorage();
  const session = fakeStorage();
  session.setItem(CHAT_SESSION_BACKUP_KEY, JSON.stringify({ schema: 1, savedAt: 1, ...state }));
  const result = saveChatState({ local, session, ...state });
  assert.deepEqual(result, { ok: true, mode: 'local' });
  assert.equal(JSON.parse(local.getItem('veridell:chat:threads:v1'))[0].id, 'thread-1');
  assert.equal(local.getItem('veridell:chat:active-thread:v1'), 'thread-1');
  assert.equal(JSON.parse(local.getItem('veridell:chat:saved:v3')).length, 1);
  assert.equal(session.getItem(CHAT_SESSION_BACKUP_KEY), null);
  assert.equal(readChatBackup({ local, session }), null);
});

test('blocked local storage falls back to a session snapshot that can be restored', () => {
  const local = fakeStorage({ failWrites: true });
  const session = fakeStorage();
  const result = saveChatState({ local, session, ...state });
  assert.deepEqual(result, { ok: true, mode: 'session' });
  const restored = readChatBackup({ local, session });
  assert.equal(restored.activeThreadId, 'thread-1');
  assert.deepEqual(restored.threads, state.threads);
  assert.deepEqual(restored.messages, state.messages);
  assert.deepEqual(restored.saved, state.saved);
});

test('a newer local save invalidates an older session snapshot', () => {
  const local = fakeStorage();
  const session = fakeStorage();
  const old = { schema: 1, savedAt: 10, ...state };
  session.setItem(CHAT_SESSION_BACKUP_KEY, JSON.stringify(old));
  local.setItem(CHAT_STORAGE_REVISION_KEY, '20');
  assert.equal(readChatBackup({ local, session }), null);
});

test('history save reports failure when both browser stores are unavailable', () => {
  const result = saveChatState({ local: null, session: null, ...state });
  assert.deepEqual(result, { ok: false, mode: 'failed' });
});

test('session backup rejects malformed or incomplete snapshots', () => {
  const session = fakeStorage();
  session.setItem(CHAT_SESSION_BACKUP_KEY, JSON.stringify({ schema: 1, threads: [] }));
  assert.equal(readChatBackup({ session }), null);
});
