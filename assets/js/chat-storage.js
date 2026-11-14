/** Resilient, device-local persistence for Amigo conversation history. */
export const CHAT_SESSION_BACKUP_KEY = 'veridell:chat:session-backup:v1';
export const CHAT_STORAGE_REVISION_KEY = 'veridell:chat:storage-revision:v1';

const KEYS = Object.freeze({
  threads: 'veridell:chat:threads:v1',
  active: 'veridell:chat:active-thread:v1',
  saved: 'veridell:chat:saved:v3',
  legacyRecent: 'veridell:chat:recent:v1',
  legacyThread: 'veridell:chat:thread:v4',
});

export function readChatBackup({ local = null, session = null } = {}) {
  try {
    const snapshot = JSON.parse(session?.getItem(CHAT_SESSION_BACKUP_KEY) || 'null');
    if (!snapshot || snapshot.schema !== 1
      || !Array.isArray(snapshot.threads)
      || !Array.isArray(snapshot.messages)
      || !Array.isArray(snapshot.saved)) return null;
    const rawRevision = Number(local?.getItem(CHAT_STORAGE_REVISION_KEY)) || 0;
    const revision = Number.isFinite(rawRevision) && rawRevision >= 0 ? rawRevision : 0;
    const savedAt = Number(snapshot.savedAt);
    if (!Number.isSafeInteger(savedAt) || savedAt <= revision) return null;
    return snapshot;
  } catch {
    return null;
  }
}

/** Save a consistent snapshot and report where it landed; never silently claim a failed save. */
export function saveChatState({ local = null, session = null, threads = [], activeThreadId = '', messages = [], saved = [] } = {}) {
  let revision = 0;
  try {
    const rawRevision = Number(local?.getItem(CHAT_STORAGE_REVISION_KEY)) || 0;
    revision = Number.isFinite(rawRevision) && rawRevision >= 0 ? rawRevision : 0;
  } catch { /* unavailable */ }
  const savedAt = Math.max(Date.now(), Math.min(Number.MAX_SAFE_INTEGER - 1, revision) + 1);
  let snapshot;
  try {
    snapshot = JSON.stringify({
      schema: 1,
      savedAt,
      threads,
      activeThreadId: String(activeThreadId || ''),
      messages,
      saved,
    });
  } catch {
    return { ok: false, mode: 'failed' };
  }

  try {
    if (!local) throw new Error('localStorage unavailable');
    local.setItem(KEYS.threads, JSON.stringify(threads));
    local.setItem(KEYS.active, String(activeThreadId || ''));
    local.setItem(KEYS.saved, JSON.stringify(saved));
    local.setItem(CHAT_STORAGE_REVISION_KEY, String(savedAt));
    try {
      local.removeItem(KEYS.legacyRecent);
      local.removeItem(KEYS.legacyThread);
    } catch { /* migration cleanup is best-effort */ }
    try { session?.removeItem(CHAT_SESSION_BACKUP_KEY); } catch { /* revision makes stale backup ignorable */ }
    return { ok: true, mode: 'local' };
  } catch {
    try {
      if (!session) throw new Error('sessionStorage unavailable');
      session.setItem(CHAT_SESSION_BACKUP_KEY, snapshot);
      return { ok: true, mode: 'session' };
    } catch {
      return { ok: false, mode: 'failed' };
    }
  }
}
