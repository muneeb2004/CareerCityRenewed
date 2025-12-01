// Prompt for Copilot: "Create React component for QR code scanning using html5-qrcode with camera permissions, decode employer QR, and check duplicate visits"

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { checkIfVisited } from '../../firestore/student';
import { getStudentSession } from '../../lib/storage';
import toast from 'react-hot-toast';

interface QRScannerProps {
  onScanSuccess: (organizationId: string) => void;
}

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  const onScanError = useCallback((errorMessage: string) => {
    // Ignore scan errors (happens when no QR in view)
    // console.log(`QR Scan Error: ${errorMessage}`);
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      // Assuming QR code contains: organization_id
      const organizationId = decodedText;

      // Check for duplicate visit
      const session = getStudentSession();
      if (session) {
        const alreadyVisited = await checkIfVisited(
          session.studentId,
          organizationId
        );
        if (alreadyVisited) {
          toast.error('You have already visited this stall!');
          return;
        }
      }

      if (typeof onScanSuccess === 'function') {
        onScanSuccess(organizationId);
      }
    },
    [onScanSuccess]
  );

  const startScanner = useCallback(async () => {
    try {
      // Ensure element exists before starting
      const element = document.getElementById('qr-reader');
      if (!element) return;

      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      scannerRef.current = scanner;

      await scanner.start(
        { 
          facingMode: 'environment',
          // iOS Optimization: Limit resolution to avoid processing 4K streams in JS
          width: { min: 640, ideal: 720, max: 1280 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        {
          fps: 10, // Increased for faster detection
          qrbox: { width: 250, height: 250 },
          disableFlip: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // Use native API if available (much faster)
          },
        } as any, // Cast to any to support experimentalFeatures
        handleScanSuccess,
        onScanError
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Camera access denied or unavailable');
    }
  }, [handleScanSuccess, onScanError]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
        try {
            if (isScanning) {
                await scannerRef.current.stop();
            }
            scannerRef.current.clear();
            scannerRef.current = null; // Clear ref
        } catch (err) {
            console.error('Error stopping scanner:', err);
        }
    }
  }, [isScanning]);

  useEffect(() => {
    const timer = setTimeout(() => {
        startScanner();
    }, 100); // Small delay to ensure DOM is ready

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="w-full flex flex-col items-center">
      <div id="qr-reader" className="w-full rounded-2xl overflow-hidden shadow-inner bg-black/5 relative min-h-[300px]"></div>
      {error && (
        <div className="mt-4 p-4 bg-red-50/80 border border-red-100 rounded-xl backdrop-blur-sm animate-pulse-slow text-center w-full">
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}
      <div className="mt-4 text-center">
        <p className="text-sm font-medium text-gray-500 bg-gray-100/50 px-4 py-2 rounded-full">
          Point your camera at an organization's QR code
        </p>
      </div>
    </div>
  );
}
