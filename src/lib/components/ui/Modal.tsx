'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

  // Ensure we're on the client before using portals
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to ensure DOM is ready for animation
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      document.body.style.overflow = 'hidden';
      // Haptic feedback on modal open
      haptics.impact();
    } else if (shouldRender) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = '';
      }, 200); // Match exit animation duration
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
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

  if (!shouldRender || !mounted) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] isolate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop - Clean semi-transparent overlay */}
      <div 
        className={`fixed inset-0 bg-gray-900/60 transition-opacity duration-200 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      
      {/* Modal Container - Centered */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none"
      >
        {/* Modal Panel */}
        <div 
          className={`pointer-events-auto relative w-full max-w-lg bg-white shadow-2xl rounded-2xl flex flex-col max-h-[90vh] transform transition-all duration-200 ease-out ${
            isAnimating 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h2 id="modal-title" className="text-xl font-bold text-gray-900">{title}</h2>
            <button 
              onClick={handleClose}
              className="p-2 -mr-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all duration-150 active:scale-95 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="overflow-y-auto p-6 overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}
