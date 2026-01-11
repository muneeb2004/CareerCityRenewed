'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptics } from '../../../lib/haptics';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmationModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [iconAnimated, setIconAnimated] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're on the client before using portals
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIconAnimated(false);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      document.body.style.overflow = 'hidden';
      // Haptic feedback based on variant
      if (variant === 'danger') {
        haptics.warning();
      } else if (variant === 'warning') {
        haptics.warning();
      } else {
        haptics.impact();
      }
      // Trigger icon animation after modal appears
      const timer = setTimeout(() => setIconAnimated(true), 150);
      return () => clearTimeout(timer);
    } else if (shouldRender) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = '';
      }, 200);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, shouldRender, variant]);

  const handleClose = useCallback(() => {
    haptics.tap();
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    haptics.impact();
    onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  if (!shouldRender || !mounted) return null;

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      buttonBg: 'bg-red-600 hover:bg-red-700',
      buttonText: 'text-white',
    },
    warning: {
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      buttonBg: 'bg-yellow-500 hover:bg-yellow-600',
      buttonText: 'text-white',
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
      buttonText: 'text-white',
    },
  };

  const styles = variantStyles[variant];

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] isolate"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-desc"
    >
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-gray-900/60 transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div 
          className={`pointer-events-auto relative w-full max-w-md bg-white shadow-2xl rounded-2xl flex flex-col p-6 transform transition-all duration-200 ease-out ${
            isAnimating 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${styles.iconBg} ${styles.iconColor} ${
              iconAnimated ? 'animate-bounce-in scale-100' : 'scale-0'
            }`} aria-hidden="true">
              <svg className={`w-6 h-6 transition-transform duration-200 ${iconAnimated ? 'animate-wiggle' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 id="confirmation-title" className="text-lg font-bold text-gray-900">{title}</h3>
              <p id="confirmation-desc" className="text-sm text-gray-500 mt-2">{message}</p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-150 active:scale-[0.97] focus:ring-2 focus:ring-gray-300 focus:outline-none"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 shadow-md active:scale-[0.97] hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none ${styles.buttonBg} ${styles.buttonText}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
