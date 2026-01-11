'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineQueue, QueuedActionType, QueuedAction } from '@/lib/offline-queue';

interface OfflineQueueState {
  isOnline: boolean;
  pendingCount: number;
  processing: boolean;
  queue: QueuedAction[];
}

/**
 * Verify actual connectivity by making a lightweight request
 * navigator.onLine is unreliable - it only checks if there's a network interface
 */
async function verifyConnectivity(): Promise<boolean> {
  try {
    // Try to fetch our health endpoint with a short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    // If fetch fails, fall back to navigator.onLine
    // This handles cases where the health endpoint doesn't exist
    return navigator.onLine;
  }
}

/**
 * React hook for offline queue management
 * Provides reactive state updates when queue changes
 * 
 * Fixes:
 * - Proper SSR handling with mounted state
 * - Active connectivity verification (not just navigator.onLine)
 * - Debounced state changes to prevent flickering
 */
export function useOfflineQueue() {
  // Start with online=true to avoid showing offline indicator during SSR/hydration
  const [state, setState] = useState<OfflineQueueState>({
    isOnline: true, // Assume online initially to prevent flash
    pendingCount: 0,
    processing: false,
    queue: [],
  });
  
  const [mounted, setMounted] = useState(false);
  const connectivityCheckRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Subscribe to queue status changes
    const unsubscribe = offlineQueue.subscribe((status) => {
      setState(prev => ({
        ...prev,
        pendingCount: status.pending,
        processing: status.processing,
        queue: offlineQueue.getQueue(),
      }));
    });

    // Debounced connectivity update to prevent rapid flickering
    const updateConnectivity = async (assumeOnline?: boolean) => {
      // Clear any pending check
      if (connectivityCheckRef.current) {
        clearTimeout(connectivityCheckRef.current);
      }
      
      // If browser says offline, trust it immediately
      if (!navigator.onLine) {
        setState(prev => ({ ...prev, isOnline: false }));
        return;
      }
      
      // If browser says online, verify with a real request (debounced)
      if (assumeOnline) {
        // Quick update for better UX, then verify
        setState(prev => ({ ...prev, isOnline: true }));
      }
      
      // Verify actual connectivity after a short delay
      connectivityCheckRef.current = setTimeout(async () => {
        const actuallyOnline = await verifyConnectivity();
        setState(prev => ({ ...prev, isOnline: actuallyOnline }));
      }, 500);
    };

    // Listen for online/offline events
    const handleOnline = () => updateConnectivity(true);
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize state with actual connectivity check
    const initializeState = async () => {
      const queueStatus = offlineQueue.getStatus();
      const actuallyOnline = await verifyConnectivity();
      
      setState({
        isOnline: actuallyOnline,
        pendingCount: queueStatus.pending,
        processing: queueStatus.processing,
        queue: offlineQueue.getQueue(),
      });
    };
    
    initializeState();

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connectivityCheckRef.current) {
        clearTimeout(connectivityCheckRef.current);
      }
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
