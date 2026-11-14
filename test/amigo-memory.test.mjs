import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORY_KEY, MEMORY_USE_KEY, MAX_MEMORY_ITEMS,
  cleanMemoryNote, normalizeMemories, createMemoryManager,
  memoryEnabled, setMemoryEnabled,
} from '../assets/js/amigo-memory.js';

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

test('memory notes are cleaned and bounded without mutating the input', () => {
  const raw = '  I prefer  simple\n Hindi explanations  ';
  assert.equal(cleanMemoryNote(raw), 'I prefer simple Hindi explanations');
  assert.equal(cleanMemoryNote('x'.repeat(400)).length, 280);
});

test('normalized memories remove empty and duplicate notes and cap the collection', () => {
  const notes = normalizeMemories(['One', 'one', '', ...Array.from({ length: 40 }, (_, i) => `Note ${i}`)]);
  assert.equal(notes[0].text, 'One');
  assert.equal(notes.length, MAX_MEMORY_ITEMS);
});

test('memory requires explicit save and explicit use opt-in', () => {
  const storage = fakeStorage();
  const manager = createMemoryManager(storage);
  assert.equal(manager.list().length, 0);
  assert.equal(memoryEnabled(storage), false);
  assert.equal(manager.add('I prefer Hindi').ok, true);
  assert.equal(memoryEnabled(storage), false);
  assert.equal(setMemoryEnabled(true, storage), true);
  assert.equal(memoryEnabled(storage), true);
  assert.equal(JSON.parse(storage.getItem(MEMORY_KEY)).length, 1);
  assert.equal(storage.getItem(MEMORY_USE_KEY), 'yes');
});

test('duplicate notes are rejected and memory can be removed, replaced and cleared', () => {
  const manager = createMemoryManager(fakeStorage());
  const saved = manager.add('Preference one');
  assert.equal(saved.ok, true);
  assert.equal(manager.add('preference ONE').reason, 'duplicate');
  assert.equal(manager.remove(saved.items[0].id).ok, true);
  assert.equal(manager.list().length, 0);
  assert.equal(manager.replace(['Imported note']).ok, true);
  assert.equal(manager.list()[0].text, 'Imported note');
  assert.equal(manager.clear(), true);
  assert.equal(manager.list().length, 0);
});

test('memory fails closed when browser storage is unavailable', () => {
  const manager = createMemoryManager(null);
  assert.equal(manager.add('Do not persist').reason, 'storage_unavailable');
  assert.equal(manager.list().length, 0);
  assert.equal(memoryEnabled(null), false);
  assert.equal(setMemoryEnabled(true, null), false);
});

test('memory notes can be edited while duplicate and blank updates are rejected', () => {
  const storage = fakeStorage();
  const memory = createMemoryManager(storage);
  const first = memory.add('I prefer concise replies.');
  const second = memory.add('Please use Hindi.');
  assert.equal(memory.update(first.items[0].id, 'Use simple Hindi.').ok, true);
  assert.equal(memory.list().find((item) => item.id === first.items[0].id).text, 'Use simple Hindi.');
  assert.equal(memory.update(first.items[0].id, 'Please use Hindi.').reason, 'duplicate');
  assert.equal(memory.update(first.items[0].id, '   ').reason, 'empty');
  assert.equal(memory.list().length, 2);
  assert.equal(second.ok, true);
  assert.equal(memory.remove(first.items[0].id).ok, true);
});

test('memory removal and clearing report failures instead of pretending the notes are gone', () => {
  const manager = createMemoryManager(null);
  assert.equal(manager.remove('missing').ok, false);
  assert.equal(manager.clear(), false);
  assert.equal(manager.replace(['Private note']).ok, false);
});
