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

// Cooldown period after successful scan (in milliseconds)
const SCAN_COOLDOWN_MS = 3000;

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null); // Store the actual MediaStream
  const isProcessingRef = useRef<boolean>(false); // Prevents concurrent scans
  const lastScannedRef = useRef<string | null>(null); // Last scanned org ID
  const lastScanTimeRef = useRef<number>(0); // Timestamp of last scan
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [workingCameras, setWorkingCameras] = useState<any[]>([]); // Only front + main back
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);
  const [isChromeIOS, setIsChromeIOS] = useState(false);

  // Detect Chrome on iOS on mount
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const chromeIOS = isIOS && /CriOS/.test(navigator.userAgent);
    setIsChromeIOS(chromeIOS);
  }, []);

  const onScanError = useCallback((errorMessage: string) => {
    // Ignore scan errors (happens when no QR in view)
    // console.log(`QR Scan Error: ${errorMessage}`);
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      const organizationId = decodedText.trim();
      const now = Date.now();

      // Check 1: Already processing a scan
      if (isProcessingRef.current) {
        return;
      }

      // Check 2: Same QR code scanned within cooldown period
      if (
        lastScannedRef.current === organizationId &&
        now - lastScanTimeRef.current < SCAN_COOLDOWN_MS
      ) {
        return;
      }

      // Lock processing
      isProcessingRef.current = true;
      lastScannedRef.current = organizationId;
      lastScanTimeRef.current = now;

      try {
        // Check for duplicate visit in database
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
          await onScanSuccess(organizationId);
        }
      } catch (error) {
        console.error('Scan processing error:', error);
        toast.error('Failed to process scan. Please try again.');
      } finally {
        // Unlock after cooldown period
        setTimeout(() => {
          isProcessingRef.current = false;
        }, SCAN_COOLDOWN_MS);
      }
    },
    [onScanSuccess]
  );

  const startScanner = useCallback(async (cameraId?: number | string) => {
    // Check if browser supports media devices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not supported in this browser. Please make sure you are using HTTPS.');
      return;
    }

    try {
      // Ensure element exists before starting
      const element = document.getElementById('qr-reader');
      if (!element) return;

      // IMPORTANT: Fully stop and clear any existing scanner instance first
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) { // Html5QrcodeScannerState.SCANNING = 2
            await scannerRef.current.stop();
          }
        } catch (e) {
          // ignore stop error
        }
        try {
          scannerRef.current.clear();
        } catch (e) {
          // ignore clear error
        }
        scannerRef.current = null;
      }

      // Also manually clear any leftover video elements to prevent duplicates
      const existingVideos = element.querySelectorAll('video');
      existingVideos.forEach(video => {
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        video.remove();
      });
      
      // Clear inner HTML to remove any leftover elements
      element.innerHTML = '';

      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      scannerRef.current = scanner;

      // Detect Chrome on iOS (uses WebKit, not Chromium)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChromeIOS = isIOS && /CriOS/.test(navigator.userAgent);
      
      let cameraConfig: any;
      let selectedCameraIndex = 0;

      // If a specific camera index was requested (from camera switch), use it
      if (typeof cameraId === 'number' && workingCameras.length > 0) {
          const cam = workingCameras[cameraId];
          if (cam) {
              cameraConfig = { deviceId: { exact: cam.id } };
              selectedCameraIndex = cameraId;
          } else {
              cameraConfig = { facingMode: 'environment' };
          }
      } else if (workingCameras.length > 0 && !isChromeIOS) {
          // We already have a filtered camera list, use the back camera (index 0)
          cameraConfig = { deviceId: { exact: workingCameras[0].id } };
          selectedCameraIndex = 0;
      } else {
          // First load or Chrome iOS - enumerate cameras and filter to just front + main back
          try {
              const devices = await Html5Qrcode.getCameras();
              if (devices && devices.length > 0) {
                  // Filter to keep only: main back camera + front camera
                  // Skip ultrawide, telephoto, macro, depth cameras
                  const filtered: any[] = [];
                  
                  // Find the main back camera (usually camera 0, or has "back" without "wide/ultra/tele")
                  const backCameras = devices.filter(d => {
                      const label = d.label.toLowerCase();
                      return !label.includes('front');
                  });
                  
                  // Pick the FIRST back camera as main (camera 0 is usually main on Android)
                  // Or find one that doesn't have wide/ultra/tele in name
                  let mainBack = backCameras.find(d => {
                      const label = d.label.toLowerCase();
                      return !label.includes('wide') && !label.includes('ultra') && 
                             !label.includes('tele') && !label.includes('macro') &&
                             !label.includes('depth') && (label.includes('0') || label.includes('back'));
                  });
                  if (!mainBack && backCameras.length > 0) {
                      // Just use the first back-facing camera
                      mainBack = backCameras[0];
                  }
                  
                  // Find front camera
                  const frontCam = devices.find(d => d.label.toLowerCase().includes('front'));
                  
                  // Build working cameras list: [back, front] - only these 2
                  if (mainBack) filtered.push({ ...mainBack, displayName: 'Back Camera' });
                  if (frontCam) filtered.push({ ...frontCam, displayName: 'Front Camera' });
                  
                  // If we couldn't identify properly, just use first 2 cameras
                  if (filtered.length === 0 && devices.length > 0) {
                      filtered.push({ ...devices[0], displayName: 'Camera 1' });
                      if (devices.length > 1) {
                          filtered.push({ ...devices[1], displayName: 'Camera 2' });
                      }
                  }
                  
                  setWorkingCameras(filtered);
                  
                  if (filtered.length > 0 && !isChromeIOS) {
                      cameraConfig = { deviceId: { exact: filtered[0].id } };
                      selectedCameraIndex = 0;
                  } else {
                      cameraConfig = { facingMode: 'environment' };
                  }
              } else {
                  cameraConfig = { facingMode: 'environment' };
              }
          } catch (err) {
              console.log("Permission not granted yet, using generic constraint");
              cameraConfig = { facingMode: 'environment' };
          }
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 5, // Reduced to prevent rapid multiple scans
          qrbox: { width: 250, height: 250 },
          disableFlip: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // Use native API if available (much faster)
          },
        } as any, // Cast to any to support experimentalFeatures
        handleScanSuccess,
        onScanError
      );

      // Capture the MediaStream for reliable cleanup later
      const videoElement = document.querySelector('#qr-reader video') as HTMLVideoElement;
      if (videoElement && videoElement.srcObject) {
        streamRef.current = videoElement.srcObject as MediaStream;
        console.log('[QRScanner] Captured stream with tracks:', streamRef.current.getTracks().map(t => t.label));
      }

      setIsScanning(true);
      setError(''); // Clear previous errors on success
      setActiveCameraIndex(selectedCameraIndex);

    } catch (err: any) {
      console.error('Scanner error details:', err);
      
      // Detect Chrome on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChromeIOS = isIOS && /CriOS/.test(navigator.userAgent);
      
      let errorMessage = 'Camera access denied or unavailable.';
      
      if (typeof err === 'string') {
          errorMessage = err;
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          if (isChromeIOS) {
              errorMessage = 'Camera not available in Chrome on iOS. Please use Safari for the best experience.';
          } else {
              errorMessage = 'No camera found on this device.';
          }
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Camera is being used by another application or is invalid.';
      } else if (err.name === 'OverconstrainedError') {
          if (isChromeIOS) {
              errorMessage = 'Camera constraints not supported. Please use Safari for the best experience.';
          } else {
              errorMessage = 'Camera does not meet the required resolution constraints.';
          }
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          errorMessage = 'Camera access requires a secure HTTPS connection.';
      }

      setError(errorMessage);
    }
  }, [handleScanSuccess, onScanError, workingCameras]);

  const handleSwitchCamera = useCallback(async () => {
      if (workingCameras.length < 2) {
          toast.error('No other cameras available');
          return;
      }

      try {
          // Simply cycle to next camera in our filtered list
          const nextIndex = (activeCameraIndex + 1) % workingCameras.length;
          const nextCamera = workingCameras[nextIndex];
          
          toast.loading(`Switching to ${nextCamera.displayName || 'Camera ' + (nextIndex + 1)}...`, { id: 'camera-switch' });
          
          await startScanner(nextIndex);
          
          toast.success(`Switched to ${nextCamera.displayName || 'camera'}`, { id: 'camera-switch' });
      } catch (err) {
          console.error('Camera switch error:', err);
          toast.error('Failed to switch camera. Try restarting the scanner.', { id: 'camera-switch' });
      }
  }, [workingCameras, activeCameraIndex, startScanner]);

  const stopScanner = useCallback(async () => {
    // Capture video elements and stream tracks before attempting to stop
    const container = document.getElementById('qr-reader');
    const videoElements = container?.querySelectorAll('video') || [];
    
    // Collect all tracks from all video elements
    const allTracks: MediaStreamTrack[] = [];
    videoElements.forEach(video => {
      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => allTracks.push(track));
      }
    });

    if (scannerRef.current) {
        try {
            const state = scannerRef.current.getState();
            if (state === 2) { // Html5QrcodeScannerState.SCANNING = 2
              await scannerRef.current.stop();
            }
        } catch (err) {
            // Ignore error if scanner wasn't running or already stopped
        }
        
        try {
            scannerRef.current.clear();
        } catch (e) {
            // ignore clear error
        }

        scannerRef.current = null;
    }

    // Emergency manual cleanup: Ensure all tracks are definitely stopped
    allTracks.forEach(track => {
        try {
            track.stop();
        } catch (e) {
            console.warn('Error manually stopping track:', e);
        }
    });

    // Remove any leftover video elements
    videoElements.forEach(video => {
      try {
        video.remove();
      } catch (e) {
        // ignore
      }
    });

    // Clear container content
    if (container) {
      container.innerHTML = '';
    }

    setIsScanning(false);
  }, []);

  // Aggressive cleanup function that stops all camera streams globally
  const forceStopAllCameras = useCallback(() => {
    console.log('[QRScanner] forceStopAllCameras called');
    
    // 1. Stop our stored MediaStream first (most reliable)
    if (streamRef.current) {
      console.log('[QRScanner] Stopping stored stream');
      streamRef.current.getTracks().forEach(track => {
        console.log('[QRScanner] Stopping stored track:', track.label, track.readyState);
        track.stop();
      });
      streamRef.current = null;
    }

    // 2. Stop scanner instance
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        console.log('[QRScanner] Scanner state:', state);
        if (state === 2) { // SCANNING
          scannerRef.current.stop().catch((e) => console.log('[QRScanner] Stop error:', e));
        }
        scannerRef.current.clear();
      } catch (e) {
        console.log('[QRScanner] Scanner cleanup error:', e);
      }
      scannerRef.current = null;
    }

    // 3. Stop ALL video elements in the entire document
    document.querySelectorAll('video').forEach(video => {
      try {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => {
            console.log('[QRScanner] Stopping video track:', track.label, track.readyState);
            track.stop();
          });
        }
        video.srcObject = null;
        video.remove(); // Also remove the video element
      } catch (e) {}
    });

    // 4. Clear the QR reader container
    const container = document.getElementById('qr-reader');
    if (container) {
      container.innerHTML = '';
    }

    setIsScanning(false);
  }, []);

  // Store ref to cleanup function so it's always accessible
  const cleanupRef = useRef(forceStopAllCameras);
  cleanupRef.current = forceStopAllCameras;

  useEffect(() => {
    const timer = setTimeout(() => {
        startScanner();
    }, 100); // Small delay to ensure DOM is ready

    // Direct cleanup function that doesn't rely on any refs or state
    const directCleanup = () => {
      console.log('[QRScanner] Direct cleanup triggered');
      
      // Stop stored stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('[QRScanner] Direct: stopping stored track', track.label);
          track.stop();
        });
        streamRef.current = null;
      }
      
      // Stop scanner
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }
      
      // Stop all videos
      document.querySelectorAll('video').forEach(video => {
        const stream = video.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => {
            console.log('[QRScanner] Direct: stopping video track', track.label);
            track.stop();
          });
        }
        video.srcObject = null;
        video.remove();
      });
      
      const container = document.getElementById('qr-reader');
      if (container) container.innerHTML = '';
      
      setIsScanning(false);
    };

    const handleVisibilityChange = () => {
      console.log('[QRScanner] Visibility changed to:', document.visibilityState);
      if (document.visibilityState === 'hidden') {
        directCleanup();
      } else if (document.visibilityState === 'visible') {
        // User returned to the page - restart the scanner
        console.log('[QRScanner] User returned - restarting scanner');
        setTimeout(() => {
          startScanner();
        }, 200); // Small delay to ensure everything is ready
      }
    };

    const handleBeforeUnload = () => {
      console.log('[QRScanner] beforeunload fired');
      directCleanup();
    };

    const handlePageHide = () => {
      console.log('[QRScanner] pagehide fired');
      directCleanup();
    };

    // Add all event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('[QRScanner] Component unmounting - cleanup triggered');
      clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      directCleanup();
    };
  }, [startScanner]);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full">
          <div 
            id="qr-reader" 
            className="w-full rounded-2xl overflow-hidden shadow-inner bg-black/5 relative"
            style={{ minHeight: '250px' }}
          ></div>
          {/* Style the video element dynamically for proper aspect ratio */}
          <style jsx global>{`
            #qr-reader {
              display: flex;
              align-items: center;
              justify-content: center;
            }
            #qr-reader video {
              width: 100% !important;
              height: auto !important;
              max-height: 70vh;
              object-fit: cover;
              border-radius: 1rem;
            }
            #qr-reader img {
              display: none !important;
            }
            /* Hide the library's default scan region border */
            #qr-reader__scan_region {
              min-height: unset !important;
            }
            #qr-reader__dashboard {
              display: none !important;
            }
            /* Ensure only one video element is visible */
            #qr-reader video:not(:first-of-type) {
              display: none !important;
            }
          `}</style>
          {/* Hide camera switch on Chrome iOS since deviceId constraints don't work */}
          {workingCameras.length > 1 && !isChromeIOS && (
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
