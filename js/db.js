// Stockage local (IndexedDB) : un document de données + les photos (blobs).

const DB_NAME = 'cintre';
const DB_VERSION = 1;
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kvGet = (key) => tx('kv', 'readonly', (s) => s.get(key));
export const kvSet = (key, val) => tx('kv', 'readwrite', (s) => s.put(val, key));

export const photoGet = (id) => tx('photos', 'readonly', (s) => s.get(id));
export const photoPut = (rec) => tx('photos', 'readwrite', (s) => s.put(rec));
export const photoDelete = (id) => tx('photos', 'readwrite', (s) => s.delete(id));
export const photoKeys = () => tx('photos', 'readonly', (s) => s.getAllKeys());

export async function estimate() {
  try { return await navigator.storage.estimate(); } catch { return null; }
}

export async function persist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { }
  return false;
}
