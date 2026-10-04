import { ExportedItem } from '../types';

const DB_NAME = 'FalconRodMaker_Exports_DB_v2';
const STORE_NAME = 'exported_items';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or initialize the IndexedDB instance
 */
export function openExportDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('format', 'format', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }
      };

      request.onsuccess = event => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
          dbPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = event => {
        console.warn('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        dbPromise = null;
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Save or update an exported item with its full high-resolution dataUrl
 */
export async function saveExportToIndexedDb(item: ExportedItem): Promise<void> {
  try {
    const db = await openExportDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn('Failed to store item in IndexedDB:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB save skipped or unavailable:', err);
  }
}

/**
 * Retrieve all exported items from IndexedDB sorted descending by creation date
 */
export async function getAllExportsFromIndexedDb(): Promise<ExportedItem[]> {
  try {
    const db = await openExportDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items: ExportedItem[] = Array.isArray(req.result) ? req.result : [];
        // Sort descending: newest first
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(items);
      };

      req.onerror = () => {
        console.warn('Failed to read items from IndexedDB:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB retrieval skipped or unavailable:', err);
    return [];
  }
}

/**
 * Delete an exported item by ID from IndexedDB
 */
export async function deleteExportFromIndexedDb(id: string): Promise<void> {
  try {
    const db = await openExportDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn('Failed to delete item from IndexedDB:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB delete skipped or unavailable:', err);
  }
}

/**
 * Clear all items from IndexedDB
 */
export async function clearAllExportsFromIndexedDb(): Promise<void> {
  try {
    const db = await openExportDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn('Failed to clear items from IndexedDB:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB clear skipped or unavailable:', err);
  }
}
