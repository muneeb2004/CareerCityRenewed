/**
 * Offline Scan Queue
 * 
 * Manages queuing and syncing of scan data when offline.
 * Uses IndexedDB for persistence across browser sessions.
 */

const DB_NAME = 'CareerCityScanQueue';
const DB_VERSION = 1;
const STORE_NAME = 'pendingScans';

export interface QueuedScan {
  id: string;            // Unique ID for the scan
  studentId: string;     // Combined student ID
  stallId: string;       // Organization/Stall ID
  timestamp: string;     // ISO timestamp
  attempts: number;      // Number of sync attempts
  lastAttempt?: string;  // ISO timestamp of last attempt
  error?: string;        // Last error message
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('stallId', 'stallId', { unique: false });
      }
    };
  });
}

/**
 * Add a scan to the offline queue
 */
export async function queueScan(studentId: string, stallId: string): Promise<string> {
  const database = await initDB();
  
  const scan: QueuedScan = {
    id: `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    studentId,
    stallId,
    timestamp: new Date().toISOString(),
    attempts: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(scan);

    request.onsuccess = () => {
      console.log(`[ScanQueue] Queued scan: ${scan.id}`);
      resolve(scan.id);
    };

    request.onerror = () => {
      console.error('[ScanQueue] Failed to queue scan:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get all pending scans
 */
export async function getPendingScans(): Promise<QueuedScan[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      console.error('[ScanQueue] Failed to get pending scans:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get pending scan count
 */
export async function getPendingScanCount(): Promise<number> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Remove a scan from the queue (after successful sync)
 */
export async function removeScan(id: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`[ScanQueue] Removed scan: ${id}`);
      resolve();
    };

    request.onerror = () => {
      console.error('[ScanQueue] Failed to remove scan:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Update a scan's attempt count and error
 */
export async function updateScanAttempt(id: string, error?: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const scan = getRequest.result as QueuedScan | undefined;
      if (!scan) {
        resolve();
        return;
      }

      scan.attempts += 1;
      scan.lastAttempt = new Date().toISOString();
      scan.error = error;

      const putRequest = store.put(scan);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Sync all pending scans to the server
 * @returns Number of successfully synced scans
 */
export async function syncPendingScans(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) {
    console.log('[ScanQueue] Offline, skipping sync');
    return { synced: 0, failed: 0 };
  }

  const pendingScans = await getPendingScans();
  if (pendingScans.length === 0) {
    return { synced: 0, failed: 0 };
  }

  console.log(`[ScanQueue] Syncing ${pendingScans.length} pending scans...`);
  
  let synced = 0;
  let failed = 0;

  for (const scan of pendingScans) {
    // Skip scans that have failed too many times
    if (scan.attempts >= 5) {
      console.warn(`[ScanQueue] Scan ${scan.id} exceeded max attempts, removing`);
      await removeScan(scan.id);
      failed++;
      continue;
    }

    try {
      const response = await fetch('/api/analytics/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: scan.studentId,
          stallId: scan.stallId,
          timestamp: scan.timestamp,
        }),
      });

      if (response.ok) {
        await removeScan(scan.id);
        synced++;
      } else {
        const errorData = await response.json().catch(() => ({}));
        await updateScanAttempt(scan.id, errorData.error || `HTTP ${response.status}`);
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await updateScanAttempt(scan.id, errorMessage);
      failed++;
    }
  }

  console.log(`[ScanQueue] Sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

/**
 * Clear all pending scans
 */
export async function clearPendingScans(): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('[ScanQueue] Cleared all pending scans');
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Setup automatic sync on connection restore
 */
export function setupAutoSync(onSyncComplete?: (result: { synced: number; failed: number }) => void): () => void {
  const handleOnline = async () => {
    console.log('[ScanQueue] Connection restored, syncing...');
    const result = await syncPendingScans();
    onSyncComplete?.(result);
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
