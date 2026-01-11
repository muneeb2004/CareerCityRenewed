'use client';

import { useState, useEffect } from 'react';
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue';

/**
 * Offline Status Indicator
 * Shows when the app is offline and displays pending queue count
 * 
 * Uses mounted state to prevent hydration mismatch flash
 */
export function OfflineIndicator() {
  const { isOnline, pendingCount, processing } = useOfflineQueue();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted (prevents hydration flash)
  // and don't render if online with no pending items
  if (!mounted || (isOnline && pendingCount === 0)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-fade-in-up">
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg">
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
            />
          </svg>
          <span className="text-sm font-medium">
            Offline Mode
            {pendingCount > 0 && (
              <span className="ml-1">
                ({pendingCount} pending)
              </span>
            )}
          </span>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg">
          {processing ? (
            <>
              <svg 
                className="w-5 h-5 animate-spin" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              <span className="text-sm font-medium">
                Syncing {pendingCount} items...
              </span>
            </>
          ) : (
            <>
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
              <span className="text-sm font-medium">
                {pendingCount} items queued
              </span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compact offline badge for headers/navbars
 * Uses mounted state to prevent hydration mismatch flash
 */
export function OfflineBadge() {
  const { isOnline, pendingCount } = useOfflineQueue();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted or if online with no pending items
  if (!mounted || (isOnline && pendingCount === 0)) {
    return null;
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        !isOnline 
          ? 'bg-amber-100 text-amber-700' 
          : 'bg-blue-100 text-blue-700'
      }`}
    >
      <span 
        className={`w-2 h-2 rounded-full ${
          !isOnline ? 'bg-amber-500' : 'bg-blue-500 animate-pulse'
        }`} 
      />
      {!isOnline ? 'Offline' : `${pendingCount} pending`}
    </span>
  );
}
