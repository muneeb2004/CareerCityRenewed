'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  loadStudentIdsCache, 
  validateStudentIdSync, 
  refreshStudentIdsCache,
  extractStudentIdClient 
} from '@/lib/student-validation-cache';
import { 
  queueScan, 
  getPendingScanCount, 
  syncPendingScans, 
  setupAutoSync,
  QueuedScan 
} from '@/lib/scan-queue';

export interface UseStudentValidationOptions {
  /** Auto-load cache on mount */
  autoLoad?: boolean;
  /** Auto-sync scans when coming online */
  autoSync?: boolean;
  /** Callback when sync completes */
  onSyncComplete?: (result: { synced: number; failed: number }) => void;
}

export interface UseStudentValidationReturn {
  /** Whether the cache is currently loading */
  loading: boolean;
  /** Whether the cache has been loaded at least once */
  ready: boolean;
  /** Number of pending scans in the queue */
  pendingCount: number;
  /** Whether currently online */
  isOnline: boolean;
  /** Validate a combined student ID against the cache */
  validateId: (combinedId: string) => boolean | null;
  /** Extract the numeric portion from a combined ID */
  extractId: (combinedId: string) => string | null;
  /** Queue a scan for later sync */
  queueScanForSync: (studentId: string, stallId: string) => Promise<string>;
  /** Manually trigger sync of pending scans */
  syncScans: () => Promise<{ synced: number; failed: number }>;
  /** Refresh the student IDs cache */
  refreshCache: () => Promise<void>;
}

/**
 * Hook for student ID validation with offline support
 */
export function useStudentValidation(
  options: UseStudentValidationOptions = {}
): UseStudentValidationReturn {
  const { autoLoad = true, autoSync = true, onSyncComplete } = options;

  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  
  const cleanupRef = useRef<(() => void) | null>(null);

  // Update online status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cache on mount
  useEffect(() => {
    if (!autoLoad) return;

    const loadCache = async () => {
      setLoading(true);
      try {
        await loadStudentIdsCache();
        setReady(true);
      } catch (error) {
        console.error('Failed to load student IDs cache:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCache();
  }, [autoLoad]);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingScanCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to get pending scan count:', error);
    }
  }, []);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Setup auto-sync
  useEffect(() => {
    if (!autoSync) return;

    const handleSyncComplete = (result: { synced: number; failed: number }) => {
      updatePendingCount();
      onSyncComplete?.(result);
    };

    cleanupRef.current = setupAutoSync(handleSyncComplete);

    return () => {
      cleanupRef.current?.();
    };
  }, [autoSync, onSyncComplete, updatePendingCount]);

  // Validate a student ID synchronously
  const validateId = useCallback((combinedId: string): boolean | null => {
    return validateStudentIdSync(combinedId);
  }, []);

  // Extract student ID
  const extractId = useCallback((combinedId: string): string | null => {
    return extractStudentIdClient(combinedId);
  }, []);

  // Queue a scan
  const queueScanForSync = useCallback(async (studentId: string, stallId: string): Promise<string> => {
    const id = await queueScan(studentId, stallId);
    await updatePendingCount();
    return id;
  }, [updatePendingCount]);

  // Manually sync scans
  const syncScans = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    const result = await syncPendingScans();
    await updatePendingCount();
    return result;
  }, [updatePendingCount]);

  // Refresh cache
  const refreshCache = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await refreshStudentIdsCache();
      setReady(true);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    ready,
    pendingCount,
    isOnline,
    validateId,
    extractId,
    queueScanForSync,
    syncScans,
    refreshCache,
  };
}

/**
 * Hook for recording analytics scans with offline support
 */
export function useAnalyticsScan(stallId: string) {
  const {
    loading,
    ready,
    pendingCount,
    isOnline,
    validateId,
    extractId,
    queueScanForSync,
    syncScans,
  } = useStudentValidation();

  const [syncing, setSyncing] = useState(false);

  /**
   * Record a scan with automatic offline queueing
   */
  const recordScan = useCallback(async (
    combinedStudentId: string
  ): Promise<{ success: boolean; queued?: boolean; error?: string }> => {
    // Validate ID format first
    const extractedId = extractId(combinedStudentId);
    if (!extractedId) {
      return { success: false, error: 'Invalid student ID format' };
    }

    // Validate against cache (if available)
    const isValid = validateId(combinedStudentId);
    if (isValid === false) {
      return { success: false, error: 'Student ID not found' };
    }

    // If offline, queue the scan
    if (!isOnline) {
      try {
        await queueScanForSync(combinedStudentId, stallId);
        return { success: true, queued: true };
      } catch (error) {
        return { success: false, error: 'Failed to queue scan' };
      }
    }

    // Try to record directly
    try {
      const response = await fetch('/api/analytics/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: combinedStudentId,
          stallId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        return { success: true };
      }

      // If request failed, queue for later
      await queueScanForSync(combinedStudentId, stallId);
      return { success: true, queued: true };
    } catch (error) {
      // Network error, queue for later
      await queueScanForSync(combinedStudentId, stallId);
      return { success: true, queued: true };
    }
  }, [extractId, validateId, isOnline, queueScanForSync, stallId]);

  /**
   * Manually trigger sync
   */
  const triggerSync = useCallback(async () => {
    if (syncing || !isOnline) return { synced: 0, failed: 0 };
    
    setSyncing(true);
    try {
      return await syncScans();
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOnline, syncScans]);

  return {
    loading,
    ready,
    pendingCount,
    isOnline,
    syncing,
    recordScan,
    triggerSync,
    validateId,
    extractId,
  };
}
