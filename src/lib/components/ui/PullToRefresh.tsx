'use client';

import React, { useState, useEffect, useRef } from 'react';
import { haptics } from '../../../lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const threshold = 80;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (containerRef.current && containerRef.current.scrollTop === 0) {
        setStartY(e.touches[0].clientY);
        setHasTriggeredHaptic(false);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY > 0 && !refreshing) {
        const currentY = e.touches[0].clientY;
        const distance = currentY - startY;
        
        if (distance > 0) {
          // Add resistance
          const restrictedDistance = distance < threshold * 2 
            ? distance 
            : threshold * 2 + (distance - threshold * 2) * 0.2;
            
          setPullDistance(restrictedDistance);
          
          // Haptic feedback when threshold is reached
          if (restrictedDistance > threshold && !hasTriggeredHaptic) {
            haptics.impact();
            setHasTriggeredHaptic(true);
          }
          
          // Prevent default only if we are pulling down at the top
          if (e.cancelable && distance > 5) {
             e.preventDefault(); 
          }
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > threshold && !refreshing) {
        setRefreshing(true);
        setPullDistance(threshold); // Snap to loading position
        haptics.impact();
        
        try {
          await onRefresh();
          haptics.success();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
          setStartY(0);
          setHasTriggeredHaptic(false);
        }
      } else {
        setPullDistance(0);
        setStartY(0);
        setHasTriggeredHaptic(false);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [startY, pullDistance, refreshing, onRefresh, hasTriggeredHaptic]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto relative no-scrollbar">
      <div 
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: refreshing ? 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Loading Indicator */}
        <div 
          className="absolute top-0 left-0 w-full flex justify-center items-center pointer-events-none"
          style={{ height: `${threshold}px`, marginTop: `-${threshold}px` }}
        >
          {refreshing ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          ) : (
            <div className={`transition-all duration-300 ${pullDistance > threshold ? 'scale-110' : 'scale-100'}`}>
              <svg 
                className={`w-6 h-6 transition-all duration-300 ${pullDistance > threshold ? 'text-blue-600 rotate-180' : 'text-gray-400'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          )}
        </div>
        
        {children}
      </div>
    </div>
  );
}
