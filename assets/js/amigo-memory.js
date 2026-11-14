/** User-controlled, device-local memory for Amigo.
 * No automatic profiling: a note exists only after the reader explicitly saves it.
 */
export const MEMORY_KEY = 'veridell:amigo:memory:v1';
export const MEMORY_USE_KEY = 'veridell:amigo:memory:use:v1';
export const MAX_MEMORY_ITEMS = 24;
export const MAX_MEMORY_CHARS = 280;

export function cleanMemoryNote(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MEMORY_CHARS);
}

export function normalizeMemories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value.slice(0, MAX_MEMORY_ITEMS * 2)) {
    const text = cleanMemoryNote(typeof entry === 'string' ? entry : entry?.text);
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push({ id: String(entry?.id || `memory-${out.length + 1}`), text, createdAt: Number(entry?.createdAt) || Date.now() });
    if (out.length >= MAX_MEMORY_ITEMS) break;
  }
  return out;
}

export function createMemoryManager(storage) {
  const store = () => {
    if (storage !== undefined) return storage;
    try { return globalThis.localStorage; } catch { return null; }
  };
  const read = () => {
    try { return normalizeMemories(JSON.parse(store()?.getItem(MEMORY_KEY) || '[]')); }
    catch { return []; }
  };
  const write = (items) => {
    const next = normalizeMemories(items);
    try { const target = store(); if (!target) return false; target.setItem(MEMORY_KEY, JSON.stringify(next)); return true; }
    catch { return false; }
  };
  return Object.freeze({
    list: read,
    add(note) {
      const text = cleanMemoryNote(note);
      if (!text) return { ok: false, reason: 'empty', items: read() };
      const current = read();
      if (current.some((item) => item.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
        return { ok: false, reason: 'duplicate', items: current };
      }
      if (current.length >= MAX_MEMORY_ITEMS) return { ok: false, reason: 'full', items: current };
      const item = { id: `memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, text, createdAt: Date.now() };
      const items = [item, ...current];
      const ok = write(items);
      return { ok, reason: ok ? 'saved' : 'storage_unavailable', items: ok ? items : current };
    },
    update(id, note) {
      const text = cleanMemoryNote(note);
      const current = read();
      const index = current.findIndex((item) => item.id === id);
      if (index < 0) return { ok: false, reason: 'not_found', items: current };
      if (!text) return { ok: false, reason: 'empty', items: current };
      if (current.some((item) => item.id !== id && item.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
        return { ok: false, reason: 'duplicate', items: current };
      }
      const next = current.map((item) => item.id === id ? { ...item, text } : item);
      const ok = write(next);
      return { ok, reason: ok ? 'updated' : 'storage_unavailable', items: ok ? next : current };
    },
    remove(id) {
      const current = read();
      const items = current.filter((item) => item.id !== id);
      const ok = write(items);
      return { ok, items: ok ? items : current };
    },
    clear() { return write([]); },
    replace(value) {
      const items = normalizeMemories(value);
      const ok = write(items);
      return { ok, items: ok ? items : read() };
    },
  });
}

export function memoryEnabled(storage) {
  try { const target = storage === undefined ? globalThis.localStorage : storage; return target?.getItem(MEMORY_USE_KEY) === 'yes'; }
  catch { return false; }
}

export function setMemoryEnabled(enabled, storage) {
  try { const target = storage === undefined ? globalThis.localStorage : storage; if (!target) return false; target.setItem(MEMORY_USE_KEY, enabled ? 'yes' : 'no'); return true; }
  catch { return false; }
}
