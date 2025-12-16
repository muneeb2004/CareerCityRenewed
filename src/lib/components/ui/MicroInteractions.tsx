'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { haptics } from '../../haptics';

/**
 * Ripple Effect Component
 * Creates a Material Design-style ripple effect on click
 */
interface RippleProps {
  color?: string;
  duration?: number;
}

export function useRipple(duration: number = 600) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const nextId = useRef(0);

  const addRipple = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const id = nextId.current++;

    setRipples((prev) => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
    }, duration);
  }, [duration]);

  return { ripples, addRipple };
}

interface RippleContainerProps extends RippleProps {
  ripples: Array<{ x: number; y: number; id: number }>;
}

export function RippleContainer({ ripples, color = 'rgba(255, 255, 255, 0.4)', duration = 600 }: RippleContainerProps) {
  return (
    <span className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            backgroundColor: color,
            transform: 'translate(-50%, -50%)',
            animationDuration: `${duration}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Interactive Button with micro-interactions
 */
interface InteractiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hapticPattern?: 'light' | 'medium' | 'heavy' | 'impact';
  rippleColor?: string;
  scaleOnPress?: boolean;
  children: React.ReactNode;
}

export function InteractiveButton({
  hapticPattern = 'impact',
  rippleColor = 'rgba(255, 255, 255, 0.3)',
  scaleOnPress = true,
  children,
  className = '',
  onClick,
  ...props
}: InteractiveButtonProps) {
  const { ripples, addRipple } = useRipple();
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(e);
    haptics[hapticPattern === 'impact' ? 'impact' : hapticPattern === 'heavy' ? 'press' : hapticPattern === 'medium' ? 'click' : 'tap']();
    onClick?.(e);
  }, [addRipple, hapticPattern, onClick]);

  return (
    <button
      {...props}
      className={`relative overflow-hidden transition-all duration-150 ${
        scaleOnPress && isPressed ? 'scale-[0.97]' : ''
      } ${className}`}
      onClick={handleClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
    >
      <RippleContainer ripples={ripples} color={rippleColor} />
      {children}
    </button>
  );
}

/**
 * Pressable component that provides tactile feedback
 */
interface PressableProps {
  onPress?: () => void;
  hapticOnPress?: boolean;
  hapticPattern?: 'light' | 'medium' | 'heavy' | 'impact';
  scaleAmount?: number;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Pressable({
  onPress,
  hapticOnPress = true,
  hapticPattern = 'impact',
  scaleAmount = 0.97,
  children,
  className = '',
  disabled = false,
}: PressableProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (hapticOnPress) {
      haptics[hapticPattern === 'impact' ? 'impact' : hapticPattern === 'heavy' ? 'press' : hapticPattern === 'medium' ? 'click' : 'tap']();
    }
    onPress?.();
  }, [disabled, hapticOnPress, hapticPattern, onPress]);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`cursor-pointer select-none transition-transform duration-100 ease-out ${
        isPressed && !disabled ? `scale-[${scaleAmount}]` : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{
        transform: isPressed && !disabled ? `scale(${scaleAmount})` : 'scale(1)',
      }}
      onClick={handlePress}
      onKeyDown={(e) => e.key === 'Enter' && handlePress()}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => !disabled && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
    >
      {children}
    </div>
  );
}

/**
 * Animated Counter with smooth number transitions
 */
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  formatter?: (value: number) => string;
}

export function AnimatedCounter({
  value,
  duration = 500,
  className = '',
  formatter = (v) => v.toLocaleString(),
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;

    const startValue = prevValue.current;
    const diff = value - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + diff * easeProgress;
      
      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span className={className}>{formatter(displayValue)}</span>;
}

/**
 * Shimmer loading effect
 */
interface ShimmerProps {
  className?: string;
  children?: React.ReactNode;
}

export function Shimmer({ className = '', children }: ShimmerProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

/**
 * Bounce animation wrapper
 */
interface BounceProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function Bounce({ children, className = '', delay = 0 }: BounceProps) {
  return (
    <div
      className={`animate-bounce-in ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Scale on hover wrapper
 */
interface ScaleOnHoverProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function ScaleOnHover({ children, scale = 1.02, className = '' }: ScaleOnHoverProps) {
  return (
    <div
      className={`transition-transform duration-200 ease-out hover:scale-(--hover-scale) ${className}`}
      style={{ '--hover-scale': scale } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Stagger animation for lists
 */
interface StaggerProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function Stagger({ children, staggerDelay = 50, className = '' }: StaggerProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className="animate-fade-in-up opacity-0"
          style={{ animationDelay: `${index * staggerDelay}ms`, animationFillMode: 'forwards' }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/**
 * Pulse animation for attention
 */
interface PulseProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
}

export function Pulse({ children, className = '', intensity = 'medium' }: PulseProps) {
  const intensityClasses = {
    subtle: 'animate-pulse-subtle',
    medium: 'animate-pulse-medium',
    strong: 'animate-pulse-strong',
  };

  return (
    <div className={`${intensityClasses[intensity]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Glow effect on hover
 */
interface GlowProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Glow({ children, color = 'rgba(91, 44, 111, 0.4)', className = '' }: GlowProps) {
  return (
    <div
      className={`transition-shadow duration-300 hover:shadow-glow ${className}`}
      style={{ '--glow-color': color } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Tilt effect on hover (3D card effect)
 */
interface TiltProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

export function Tilt({ children, className = '', maxTilt = 5 }: TiltProps) {
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const rotateX = (mouseY / (rect.height / 2)) * -maxTilt;
    const rotateY = (mouseX / (rect.width / 2)) * maxTilt;
    
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
  }, [maxTilt]);

  const handleMouseLeave = useCallback(() => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{ transform }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

export default {
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
};
