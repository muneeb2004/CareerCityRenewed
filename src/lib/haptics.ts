/**
 * Haptic Feedback Utility
 * Provides premium tactile feedback for mobile interactions using the Vibration API
 * Falls back gracefully on unsupported devices
 */

export type HapticPattern = 
  | 'light'      // Subtle tap feedback
  | 'medium'     // Standard interaction feedback
  | 'heavy'      // Strong confirmation feedback
  | 'success'    // Positive completion pattern
  | 'warning'    // Alert/caution pattern
  | 'error'      // Error/failure pattern
  | 'selection'  // Item selection feedback
  | 'impact'     // Button press impact
  | 'double'     // Double tap acknowledgment
  | 'notification'; // Attention-grabbing pattern

// Vibration patterns in milliseconds [vibrate, pause, vibrate, pause, ...]
const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [30, 50, 30],
  warning: [50, 30, 50, 30, 50],
  error: [100, 50, 100],
  selection: 15,
  impact: 35,
  double: [20, 40, 20],
  notification: [50, 100, 50, 100, 100],
};

/**
 * Check if haptic feedback is supported
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback with a specific pattern
 * @param pattern - The haptic pattern to trigger
 */
export function haptic(pattern: HapticPattern = 'medium'): void {
  if (!isHapticsSupported()) return;
  
  try {
    const vibrationPattern = HAPTIC_PATTERNS[pattern];
    navigator.vibrate(vibrationPattern);
  } catch {
    // Silently fail if vibration is not allowed
  }
}

/**
 * Stop any ongoing haptic feedback
 */
export function stopHaptic(): void {
  if (!isHapticsSupported()) return;
  
  try {
    navigator.vibrate(0);
  } catch {
    // Silently fail
  }
}

/**
 * Pre-configured haptic feedback functions for common interactions
 */
export const haptics = {
  /** Light tap for subtle interactions like hover or focus */
  tap: () => haptic('light'),
  
  /** Standard click/press feedback */
  click: () => haptic('medium'),
  
  /** Heavy impact for important actions */
  press: () => haptic('heavy'),
  
  /** Success completion feedback */
  success: () => haptic('success'),
  
  /** Warning/caution feedback */
  warning: () => haptic('warning'),
  
  /** Error/failure feedback */
  error: () => haptic('error'),
  
  /** Item selection feedback */
  select: () => haptic('selection'),
  
  /** Button impact feedback */
  impact: () => haptic('impact'),
  
  /** Double tap acknowledgment */
  doubleTap: () => haptic('double'),
  
  /** Notification alert */
  notification: () => haptic('notification'),
};

/**
 * React hook-friendly haptic trigger with optional callback
 * Useful for wrapping event handlers
 */
export function withHaptic<T extends (...args: unknown[]) => unknown>(
  callback: T,
  pattern: HapticPattern = 'medium'
): T {
  return ((...args: unknown[]) => {
    haptic(pattern);
    return callback(...args);
  }) as T;
}

/**
 * Create a haptic-enhanced click handler
 */
export function createHapticHandler(
  handler: () => void,
  pattern: HapticPattern = 'impact'
): () => void {
  return () => {
    haptic(pattern);
    handler();
  };
}

export default haptics;
