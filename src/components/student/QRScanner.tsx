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
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

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

  const startScanner = useCallback(async (cameraId?: string) => {
    // Check if browser supports media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not supported in this browser. Please make sure you are using HTTPS.');
      return;
    }

    try {
      // Ensure element exists before starting
      const element = document.getElementById('qr-reader');
      if (!element) return;

      // Clear any existing scanner instance
      if (scannerRef.current) {
        try {
           await scannerRef.current.stop();
        } catch (e) {
           // ignore stop error
        }
      }

      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      scannerRef.current = scanner;

      const cameraConfig = cameraId 
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      await scanner.start(
        cameraConfig,
        {
          fps: 10, // Increased for faster detection
          qrbox: { width: 250, height: 250 },
          disableFlip: true,
          videoConstraints: {
            // iOS Optimization: Limit resolution to avoid processing 4K streams in JS
            width: { min: 640, ideal: 720, max: 1280 },
            height: { min: 480, ideal: 720, max: 1080 },
          },
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // Use native API if available (much faster)
          },
        } as any, // Cast to any to support experimentalFeatures
        handleScanSuccess,
        onScanError
      );

      setIsScanning(true);
      setError(''); // Clear previous errors on success

      // Fetch cameras if not already fetched
      if (cameras.length === 0) {
          Html5Qrcode.getCameras().then(devices => {
              if (devices && devices.length > 0) {
                  setCameras(devices);
                  // Try to find the active camera index if possible, otherwise default to 0
                  // Often 'environment' maps to the last camera or specific one, but hard to guess.
              }
          }).catch(err => console.log("Error getting cameras", err));
      }

    } catch (err: any) {
      console.error('Scanner error details:', err);
      
      let errorMessage = 'Camera access denied or unavailable.';
      
      if (typeof err === 'string') {
          errorMessage = err;
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Camera is being used by another application or is invalid.';
      } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not meet the required resolution constraints.';
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          errorMessage = 'Camera access requires a secure HTTPS connection.';
      }

      setError(errorMessage);
    }
  }, [handleScanSuccess, onScanError, cameras.length]);

  const handleSwitchCamera = useCallback(async () => {
      if (cameras.length < 2) return;

      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);
      const nextCameraId = cameras[nextIndex].id;

      // Stop current scanner logic is handled inside startScanner's cleanup block usually, 
      // but better to stop explicitly to update state if needed.
      // startScanner handles stop/start.
      
      await startScanner(nextCameraId);
  }, [cameras, currentCameraIndex, startScanner]);

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
      <div className="relative w-full">
          <div id="qr-reader" className="w-full rounded-2xl overflow-hidden shadow-inner bg-black/5 relative min-h-[300px]"></div>
          {cameras.length > 1 && (
              <button 
                  onClick={handleSwitchCamera}
                  className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-lg border border-white/50 text-gray-700 hover:bg-white transition-all active:scale-95 z-10"
                  title="Switch Camera"
              >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
              </button>
          )}
      </div>
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
