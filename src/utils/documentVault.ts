/**
 * Falcon Rod Maker ERP - High-Capacity Document Vault (IndexedDB)
 * Safeguards browser localStorage against QuotaExceededError (5MB limit)
 * by storing scanned PDFs, Gate Pass images, delivery slips, and transport bilty receipts
 * directly in IndexedDB (1GB+ capacity).
 */

const DB_NAME = 'FalconErpDocVault';
const DB_VERSION = 1;
const STORE_NAME = 'document_blobs';

// Memory cache for zero-latency retrieval within current active session
const memoryCache = new Map<string, string>();

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = event => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = event => {
      console.error('[DocumentVault] Failed to open IndexedDB:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

/**
 * Stores a heavy document/image data URL in IndexedDB with an ID.
 */
export async function saveDocumentToVault(docId: string, dataUrl: string): Promise<boolean> {
  if (!docId || !dataUrl) return false;
  
  // Update in-memory session cache immediately
  memoryCache.set(docId, dataUrl);

  try {
    const db = await getDB();
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(dataUrl, docId);

      req.onsuccess = () => resolve(true);
      req.onerror = err => {
        console.error('[DocumentVault] Error saving document to vault:', err);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[DocumentVault] IndexedDB write fallback:', err);
    return false;
  }
}

/**
 * Retrieves a document/image data URL by ID from IndexedDB or memory cache.
 */
export async function getDocumentFromVault(docId: string): Promise<string | null> {
  if (!docId) return null;

  // Check memory cache first
  if (memoryCache.has(docId)) {
    return memoryCache.get(docId) || null;
  }

  try {
    const db = await getDB();
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);

      req.onsuccess = () => {
        const result = req.result as string | undefined;
        if (result) {
          memoryCache.set(docId, result);
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[DocumentVault] IndexedDB read fallback:', err);
    return null;
  }
}

/**
 * Deletes a document from the vault.
 */
export async function deleteDocumentFromVault(docId: string): Promise<boolean> {
  if (!docId) return false;
  memoryCache.delete(docId);

  try {
    const db = await getDB();
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(docId);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
