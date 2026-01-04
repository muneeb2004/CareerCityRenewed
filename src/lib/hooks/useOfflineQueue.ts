'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineQueue, QueuedActionType, QueuedAction } from '@/lib/offline-queue';

interface OfflineQueueState {
  isOnline: boolean;
  pendingCount: number;
  processing: boolean;
  queue: QueuedAction[];
}

/**
 * React hook for offline queue management
 * Provides reactive state updates when queue changes
 */
export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    processing: false,
    queue: [],
  });

  useEffect(() => {
    // Subscribe to queue status changes
    const unsubscribe = offlineQueue.subscribe((status) => {
      setState(prev => ({
        ...prev,
        pendingCount: status.pending,
        processing: status.processing,
        queue: offlineQueue.getQueue(),
      }));
    });

    // Listen for online/offline events
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize state
    setState({
      isOnline: navigator.onLine,
      pendingCount: offlineQueue.getStatus().pending,
      processing: offlineQueue.getStatus().processing,
      queue: offlineQueue.getQueue(),
    });

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToQueue = useCallback((action: QueuedActionType, data: Record<string, unknown>) => {
    return offlineQueue.add(action, data);
  }, []);

  const processQueue = useCallback(async () => {
    await offlineQueue.processQueue();
  }, []);

  const clearQueue = useCallback(() => {
    offlineQueue.clear();
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    return offlineQueue.remove(id);
  }, []);

  return {
    ...state,
    addToQueue,
    processQueue,
    clearQueue,
    removeFromQueue,
  };
}
