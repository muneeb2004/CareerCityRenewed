/**
 * Micro-interactions and Haptic Feedback - Central Export
 * 
 * This module provides premium, tactile feedback and micro-animations
 * for a polished user experience across the application.
 */

// Haptic Feedback Utilities
export { 
  haptic, 
  haptics, 
  stopHaptic, 
  isHapticsSupported,
  withHaptic,
  createHapticHandler,
  type HapticPattern 
} from './haptics';

// React Hooks for Haptics
export { 
  useHaptic, 
  useHapticCallback 
} from './hooks/useHaptic';

// Micro-interaction Components
export {
  InteractiveButton,
  Pressable,
  AnimatedCounter,
  Shimmer,
  Bounce,
  ScaleOnHover,
  Stagger,
  Pulse,
  Glow,
  Tilt,
  RippleContainer,
  useRipple,
} from './components/ui/MicroInteractions';

// Enhanced Skeleton Components
export {
  Skeleton,
  CardSkeleton,
  ListRowSkeleton,
  TableRowSkeleton,
  FormFieldSkeleton,
  ButtonSkeleton,
  AvatarSkeleton,
} from './components/ui/Skeleton';
