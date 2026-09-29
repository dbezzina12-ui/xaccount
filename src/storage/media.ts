/**
 * Media blobs in IndexedDB (extension origin only - never uploaded anywhere
 * except into X's own composer during automation).
 */
const DB_NAME = 'xbs-media';
const STORE = 'media';

export interface StoredMedia {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export function putMedia(m: StoredMedia): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put(m));
}

export function getMedia(id: string): Promise<StoredMedia | undefined> {
  return tx('readonly', (s) => s.get(id) as IDBRequest<StoredMedia | undefined>);
}

export function deleteMedia(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

export function listMedia(): Promise<StoredMedia[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<StoredMedia[]>);
}

/**
 * Delete blobs no longer referenced by any post in any batch. Files younger
 * than `minAgeMs` are kept: they may belong to an editor that hasn't been
 * saved yet.
 */
export async function collectGarbage(referenced: Set<string>, minAgeMs = 10 * 60_000): Promise<number> {
  const all = await listMedia();
  const cutoff = Date.now() - minAgeMs;
  let removed = 0;
  for (const m of all) {
    if (referenced.has(m.id)) continue;
    if (new Date(m.createdAt).getTime() > cutoff) continue;
    await deleteMedia(m.id);
    removed++;
  }
  return removed;
}
