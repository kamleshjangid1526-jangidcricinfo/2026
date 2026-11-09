/* Local-first match cache. Match snapshots are idempotent: the latest snapshot replaces the previous queued snapshot. */
(() => {
  const DB_NAME = 'jangid-cricinfo-local-v1';
  const STORE = 'records';
  let dbPromise = null;
  let revision = 0;
  let channel = null;
  try { if ('BroadcastChannel' in window) channel = new BroadcastChannel('jc-offline-match'); } catch (_) {}

  function openDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => {
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    return dbPromise;
  }

  async function read(key) {
    const db = await openDb();
    if (db) {
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(key);
          req.onsuccess = () => resolve(req.result?.value ?? null);
          req.onerror = () => reject(req.error);
        });
      } catch (_) {}
    }
    try { const raw = localStorage.getItem('jc-offline:' + key); return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }

  async function write(key, value) {
    const db = await openDb();
    if (db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({ key, value, savedAt: Date.now() });
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
        return true;
      } catch (_) {}
    }
    try { localStorage.setItem('jc-offline:' + key, JSON.stringify(value)); return true; }
    catch (error) { throw new Error('मोबाइल में Offline Data सेव नहीं हो पाया: ' + (error?.message || 'Storage full')); }
  }

  async function remove(key) {
    const db = await openDb();
    if (db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(key);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (_) {}
    }
    try { localStorage.removeItem('jc-offline:' + key); } catch (_) {}
  }

  function status(state, label) {
    const el = document.getElementById('offlineSyncStatus');
    if (!el) return;
    el.dataset.state = state;
    el.textContent = label;
  }

  async function cacheState(uid, state) {
    if (!state || !uid) return;
    await write('state:' + uid, state);
    await write('last-state', { uid, state });
  }

  async function loadState(uid) {
    if (uid) {
      const own = await read('state:' + uid);
      if (own) return own;
    }
    const last = await read('last-state');
    return last?.state || null;
  }

  async function saveMatch(uid, match) {
    if (!uid || !match?.id) throw new Error('Offline Match की पहचान उपलब्ध नहीं है।');
    const copy = JSON.parse(JSON.stringify(match));
    const version = Date.now() + '-' + (++revision);
    const pending = { type: 'snapshot', uid: String(uid), match: copy, version, queuedAt: Date.now() };
    await write('match:' + uid, copy);
    await write('pending:' + uid, pending);
    try { channel?.postMessage({ type: 'match', uid: String(uid), match: copy, pending: true, version }); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('jc-offline-match', { detail: { uid: String(uid), match: copy, pending: true, version } })); } catch (_) {}
    return version;
  }

  async function saveFinish(uid, payload, liveSnapshot, finishedMatch) {
    if (!uid || !liveSnapshot?.id || !finishedMatch?.id) throw new Error('Offline Finish के लिए Match data उपलब्ध नहीं है।');
    const local = JSON.parse(JSON.stringify(finishedMatch));
    const live = JSON.parse(JSON.stringify(liveSnapshot));
    const version = Date.now() + '-' + (++revision);
    const pending = { type: 'finish', uid: String(uid), payload: JSON.parse(JSON.stringify(payload)), match: live, localMatch: local, version, queuedAt: Date.now() };
    await write('match:' + uid, local);
    await write('pending:' + uid, pending);
    try { channel?.postMessage({ type: 'match', uid: String(uid), match: local, pending: true, version }); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('jc-offline-match', { detail: { uid: String(uid), match: local, pending: true, version } })); } catch (_) {}
    return version;
  }

  async function loadMatch(uid) { return uid ? read('match:' + uid) : null; }
  async function loadPending(uid) { return uid ? read('pending:' + uid) : null; }

  async function clearPending(uid, version) {
    const key = 'pending:' + uid;
    const pending = await read(key);
    if (pending && pending.version === version) await remove(key);
    return !(await read(key));
  }

  async function markSynced(uid, version) {
    const match = await loadMatch(uid);
    const pending = await loadPending(uid);
    if (!pending && match) {
      try { channel?.postMessage({ type: 'synced', uid: String(uid), match, version }); } catch (_) {}
    }
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => console.warn('Offline app shell could not be installed:', error));
    }, { once: true });
  }

  window.JCOffline = { read, write, remove, cacheState, loadState, saveMatch, saveFinish, loadMatch, loadPending, clearPending, markSynced, status, channel };
})();
