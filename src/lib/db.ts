/**
 * IndexedDB layer (via `idb`).
 *
 * Two kinds of data live here, deliberately separated:
 *
 *   `kv`      — user data: bookmarks, counters, imported audio, download state.
 *               Small, always available, never overwritten by a content update.
 *   `media`   — binary blobs (imported / downloaded audio). Kept apart so
 *               "clear downloaded media" can wipe 100 MB without touching a
 *               single bookmark.
 *
 * Quran text, adhkar and hadith ship inside the app bundle and are cached by
 * the service worker, so they are *not* duplicated into IndexedDB.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'nur-al-iman';
const DB_VERSION = 1;

interface KvRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

interface MediaRecord {
  /** Stable key, e.g. `adhan:makkah-haram` or `quran:2:255:ar.alafasy`. */
  key: string;
  blob: Blob;
  mimeType: string;
  bytes: number;
  title?: string;
  createdAt: number;
}

interface NurDB extends DBSchema {
  kv: {
    key: string;
    value: KvRecord;
  };
  media: {
    key: string;
    value: MediaRecord;
    indexes: { 'by-created': number };
  };
}

let dbPromise: Promise<IDBPDatabase<NurDB>> | null = null;

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    // Safari private mode used to throw on mere property access.
    return false;
  }
}

export function getDb(): Promise<IDBPDatabase<NurDB>> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this browser'));
  }
  if (!dbPromise) {
    dbPromise = openDB<NurDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('media')) {
          const store = db.createObjectStore('media', { keyPath: 'key' });
          store.createIndex('by-created', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

/* --------------------------------------------------------------------- KV -- */

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    const rec = await db.get('kv', key);
    return rec?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('kv', { key, value, updatedAt: Date.now() });
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.delete('kv', key);
}

export async function kvAll(): Promise<KvRecord[]> {
  const db = await getDb();
  return db.getAll('kv');
}

/* ------------------------------------------------------------------ Media -- */

export async function mediaPut(
  key: string,
  blob: Blob,
  opts: { mimeType?: string; title?: string } = {},
): Promise<MediaRecord> {
  const db = await getDb();
  const record: MediaRecord = {
    key,
    blob,
    mimeType: opts.mimeType ?? (blob.type || 'audio/mpeg'),
    bytes: blob.size,
    title: opts.title,
    createdAt: Date.now(),
  };
  await db.put('media', record);
  return record;
}

export async function mediaGet(key: string): Promise<MediaRecord | undefined> {
  try {
    const db = await getDb();
    return await db.get('media', key);
  } catch {
    return undefined;
  }
}

export async function mediaHas(key: string): Promise<boolean> {
  return (await mediaGet(key)) !== undefined;
}

export async function mediaList(): Promise<MediaRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex('media', 'by-created');
}

export async function mediaDelete(key: string): Promise<void> {
  const db = await getDb();
  await db.delete('media', key);
}

export async function mediaClear(): Promise<number> {
  const db = await getDb();
  const n = (await db.getAll('media')).length;
  await db.clear('media');
  return n;
}

/** Total bytes of stored media, for the storage-usage meter in Settings. */
export async function mediaTotalBytes(): Promise<number> {
  const all = await mediaList();
  return all.reduce((sum, r) => sum + (r.bytes || 0), 0);
}

/** Live object URLs handed out to <audio>; revoked by `revokeObjectUrl`. */
const objectUrls = new Map<string, string>();

export async function mediaObjectUrl(key: string): Promise<string | null> {
  const cached = objectUrls.get(key);
  if (cached) return cached;
  const rec = await mediaGet(key);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  objectUrls.set(key, url);
  return url;
}

export function revokeObjectUrl(key: string): void {
  const url = objectUrls.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(key);
  }
}

/* -------------------------------------------------------------- Estimates -- */

export interface StorageEstimate {
  usage: number;
  quota: number;
  /** `navigator.storage.estimate` unavailable (older browsers). */
  unavailable: boolean;
}

export async function estimateStorage(): Promise<StorageEstimate> {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usage: est.usage ?? 0,
        quota: est.quota ?? 0,
        unavailable: false,
      };
    }
  } catch {
    /* fall through */
  }
  return { usage: 0, quota: 0, unavailable: true };
}

export function formatBytes(bytes: number, locale = 'en'): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(value)} ${units[i]}`;
}
