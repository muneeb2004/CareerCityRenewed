'use client';

import { useCallback } from 'react';
import { haptic, haptics, HapticPattern, isHapticsSupported } from '../haptics';

/**
 * React hook for haptic feedback
 * Provides memoized haptic functions to prevent unnecessary re-renders
 */
export function useHaptic() {
  const trigger = useCallback((pattern: HapticPattern = 'medium') => {
    haptic(pattern);
  }, []);

  const tap = useCallback(() => haptics.tap(), []);
  const click = useCallback(() => haptics.click(), []);
  const press = useCallback(() => haptics.press(), []);
  const success = useCallback(() => haptics.success(), []);
  const warning = useCallback(() => haptics.warning(), []);
  const error = useCallback(() => haptics.error(), []);
  const select = useCallback(() => haptics.select(), []);
  const impact = useCallback(() => haptics.impact(), []);

  return {
    trigger,
    tap,
    click,
    press,
    success,
    warning,
    error,
    select,
    impact,
    isSupported: isHapticsSupported(),
  };
}

/**
 * Hook that wraps a callback with haptic feedback
 */
export function useHapticCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  pattern: HapticPattern = 'impact',
  deps: React.DependencyList = []
): T {
  return useCallback(
    ((...args: unknown[]) => {
      haptic(pattern);
      return callback(...args);
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pattern, ...deps]
  );
}

export default useHaptic;
