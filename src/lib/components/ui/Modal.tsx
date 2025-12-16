'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { haptics } from '../../../lib/haptics';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
      // Haptic feedback on modal open
      haptics.impact();
    } else if (shouldRender) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = 'unset';
      }, 200); // Match exit animation duration
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, shouldRender]);

  const handleClose = useCallback(() => {
    haptics.tap();
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      haptics.tap();
      onClose();
    }
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  if (!shouldRender) return null;

  return (
    <div 
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
          isAnimating ? 'animate-backdrop-enter' : 'opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />
      
      {/* Modal Panel */}
      <div className={`relative w-full max-w-lg bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/50 flex flex-col max-h-[90vh] ${
        isAnimating ? 'animate-modal-enter' : 'animate-modal-exit'
      }`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 id="modal-title" className="text-xl font-bold text-gray-800">{title}</h2>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all duration-200 active:scale-90 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5 transition-transform duration-200 hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
