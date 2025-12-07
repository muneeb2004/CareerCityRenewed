'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  alreadyScannedIds?: string[]; // Organization IDs already scanned (from Firestore)
}

interface CameraDevice {
  deviceId: string;
  label: string;
  score: number; // Priority score for camera selection
}

export default function QRScanner({ onScan, onError, alreadyScannedIds = [] }: QRScannerProps) {
  // Session-based scan history (combines prop + session scans)
  const alreadyScannedRef = useRef(new Set<string>(alreadyScannedIds));
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'paused' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const scanCooldownRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isSwitchingRef = useRef(false);

  // Update alreadyScannedRef when prop changes
  useEffect(() => {
    alreadyScannedIds.forEach(id => alreadyScannedRef.current.add(id));
  }, [alreadyScannedIds]);

  // Score cameras to prioritize main back camera
  // Higher score = better camera for QR scanning
  const scoreCameraForQR = (label: string): number => {
    const l = label.toLowerCase();
    let score = 50; // Base score

    // Heavily penalize non-main cameras
    if (l.includes('ultra') || l.includes('wide angle') || l.includes('ultrawide')) score -= 100;
    if (l.includes('tele') || l.includes('zoom') || l.includes('telephoto')) score -= 100;
    if (l.includes('macro')) score -= 100;
    if (l.includes('depth') || l.includes('tof')) score -= 100;
    if (l.includes('front') || l.includes('selfie')) score -= 80;
    if (l.includes('ir') || l.includes('infrared')) score -= 100;

    // Boost main/back cameras
    if (l.includes('back') || l.includes('rear')) score += 30;
    if (l.includes('main') || l.includes('primary')) score += 40;
    if (l.includes('wide') && !l.includes('ultra')) score += 20; // "wide" without "ultra" is often the main
    if (l.includes('camera 0') || l.includes('camera0')) score += 25; // Often the main camera
    if (l.includes('environment')) score += 20;

    // Samsung specific patterns
    if (l.includes('camera2 0')) score += 30; // Samsung main camera pattern
    if (l.includes('camera2 1')) score -= 20; // Usually ultrawide on Samsung
    if (l.includes('camera2 2')) score -= 30; // Usually telephoto on Samsung
    if (l.includes('camera2 3')) score -= 40; // Usually macro/depth on Samsung

    return score;
  };

  // Completely stop camera and release all resources
  const stopCamera = useCallback(async () => {
    if (isStoppingRef.current) {
      console.log('stopCamera: Already stopping, skipping');
      return;
    }
    isStoppingRef.current = true;
    console.log('stopCamera: Starting full cleanup...');

    // 1. Stop ZXing controls FIRST
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        console.log('stopCamera: ZXing controls stopped');
      } catch (e) {
        console.log('stopCamera: ZXing stop error (ignored):', e);
      }
      controlsRef.current = null;
    }

    // 2. Stop the stored stream reference
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('stopCamera: Stopping stored track:', track.label, track.readyState);
        track.stop();
      });
      streamRef.current = null;
    }

    // 3. Stop video element's stream (may be different from stored ref)
    if (videoRef.current) {
      const video = videoRef.current;
      
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log('stopCamera: Stopping video track:', track.label, track.readyState);
          track.stop();
        });
        video.srcObject = null;
      }
      
      video.pause();
      try {
        video.src = '';
        video.load();
      } catch (e) {
        // Ignore load errors
      }
    }

    // 4. Wait for browser to release camera
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 5. Reset cooldown
    scanCooldownRef.current = false;
    
    isStoppingRef.current = false;
    console.log('stopCamera: Cleanup complete');
  }, []);

  // Initialize and enumerate cameras
  const initCameras = useCallback(async () => {
    try {
      setStatus('loading');
      setErrorMsg(null);

      // First, get camera permission - use EXACT constraint for environment camera
      console.log('initCameras: Requesting camera permission with environment constraint...');
      let permissionStream: MediaStream;
      let grantedDeviceId: string | undefined;
      
      try {
        // Try exact environment (back) camera first - this forces main camera on most devices
        permissionStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { exact: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch {
        // Fallback to ideal if exact fails
        console.log('initCameras: Exact environment failed, trying ideal...');
        permissionStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      }
      
      // Get the device ID of the camera that was granted
      const grantedTrack = permissionStream.getVideoTracks()[0];
      grantedDeviceId = grantedTrack?.getSettings()?.deviceId;
      console.log('initCameras: Permission granted, device:', grantedTrack?.label);
      
      // Stop the permission stream
      permissionStream.getTracks().forEach(t => t.stop());

      // Now enumerate all devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      console.log('initCameras: Found cameras:', videoDevices.map(d => d.label));

      // Score and sort cameras
      const scoredCams: CameraDevice[] = videoDevices.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${i + 1}`,
        score: scoreCameraForQR(d.label || '')
      }));

      // Sort by score (highest first)
      scoredCams.sort((a, b) => b.score - a.score);

      // Filter to only cameras with positive scores (main cameras)
      const mainCams = scoredCams.filter(c => c.score > 0);
      const camsToUse = mainCams.length > 0 ? mainCams : scoredCams;

      console.log('initCameras: Scored cameras:', camsToUse.map(c => `${c.label} (${c.score})`));

      if (camsToUse.length === 0) {
        throw new Error('No cameras found');
      }

      // ALWAYS prefer the camera that was granted with facingMode:environment
      // This is the camera the browser determined is the "main back camera"
      let bestIdx = 0;
      if (grantedDeviceId) {
        const grantedIdx = camsToUse.findIndex(c => c.deviceId === grantedDeviceId);
        if (grantedIdx >= 0) {
          bestIdx = grantedIdx;
          console.log('initCameras: Using browser-selected environment camera at index', bestIdx);
        }
      }

      if (mountedRef.current) {
        setCameras(camsToUse);
        setSelectedCameraIndex(bestIdx);
      }
    } catch (err) {
      console.error('initCameras error:', err);
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Camera error';
        setErrorMsg(msg.includes('Permission') ? 'Camera permission denied' : msg);
        setStatus('error');
        onError?.(msg);
      }
    }
  }, [onError]);

  // Start the scanner with selected camera
  const startCamera = useCallback(async () => {
    if (!videoRef.current || cameras.length === 0 || !mountedRef.current) {
      console.log('startCamera: Prerequisites not met');
      return;
    }
    if (isStoppingRef.current || isSwitchingRef.current) {
      console.log('startCamera: Still stopping/switching, aborting');
      return;
    }

    const cam = cameras[selectedCameraIndex];
    if (!cam) {
      console.log('startCamera: No camera at index', selectedCameraIndex);
      return;
    }

    console.log('startCamera: Starting with:', cam.label, '(score:', cam.score, ')');

    try {
      // Ensure clean state
      await stopCamera();
      
      if (!mountedRef.current) return;

      // Small delay after stop to ensure camera is released
      await new Promise(resolve => setTimeout(resolve, 100));

      // Import ZXing dynamically
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      
      if (!mountedRef.current) return;

      // Create reader with conservative settings
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 200, // Slower scanning = more reliable
        delayBetweenScanSuccess: 5000, // 5 second library-level cooldown
      });

      // Start decoding
      const controls = await reader.decodeFromVideoDevice(
        cam.deviceId,
        videoRef.current,
        (result, error) => {
          if (!mountedRef.current) return;

          if (result) {
            const code = result.getText();
            
            // Check cooldown first (most common case)
            if (scanCooldownRef.current) {
              console.log('Scan blocked: cooldown active');
              return;
            }

            // Check if already scanned (Firestore + session)
            if (alreadyScannedRef.current.has(code)) {
              console.log('Scan blocked: already scanned this employer:', code);
              // Show warning briefly
              setDuplicateWarning('Already visited this employer!');
              setTimeout(() => {
                if (mountedRef.current) setDuplicateWarning(null);
              }, 2000);
              return;
            }

            // Valid new scan!
            console.log('Valid scan:', code);
            
            // Set cooldown IMMEDIATELY
            scanCooldownRef.current = true;
            
            // Add to scanned set to prevent re-scan
            alreadyScannedRef.current.add(code);
            setScannedCount(alreadyScannedRef.current.size);
            
            // Update UI
            setLastScanned(code);
            setStatus('success');

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate(100);
            
            // Notify parent
            onScan(code);

            // Reset cooldown after 5 seconds
            setTimeout(() => {
              if (mountedRef.current) {
                scanCooldownRef.current = false;
                setLastScanned(null);
                setStatus('scanning');
              }
            }, 5000);
          }

          // Only log real errors, not "not found" which is normal
          if (error && error.name !== 'NotFoundException') {
            console.log('Scan error:', error.message);
          }
        }
      );

      // Store controls and stream reference
      controlsRef.current = controls;
      if (videoRef.current?.srcObject) {
        streamRef.current = videoRef.current.srcObject as MediaStream;
      }
      
      if (mountedRef.current) {
        setStatus('scanning');
        console.log('startCamera: Scanner active');
      }
    } catch (err) {
      console.error('startCamera error:', err);
      if (mountedRef.current) {
        setErrorMsg('Failed to start scanner. Try switching camera.');
        setStatus('error');
      }
    }
  }, [cameras, selectedCameraIndex, onScan, stopCamera]);

  // Handle pause button
  const handlePause = useCallback(async () => {
    console.log('handlePause: User clicked pause');
    await stopCamera();
    if (mountedRef.current) {
      setStatus('paused');
    }
  }, [stopCamera]);

  // Handle resume button  
  const handleResume = useCallback(() => {
    console.log('handleResume: User clicked resume');
    startCamera();
  }, [startCamera]);

  // Handle camera switch with retry logic
  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length <= 1 || isSwitchingRef.current) return;
    
    console.log('handleSwitchCamera: Switching camera...');
    isSwitchingRef.current = true;
    
    try {
      await stopCamera();
      
      // Wait for camera to fully release
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newIndex = (selectedCameraIndex + 1) % cameras.length;
      console.log('handleSwitchCamera: Switching to index', newIndex, cameras[newIndex]?.label);
      
      setSelectedCameraIndex(newIndex);
      
      // Wait a bit more then start
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (mountedRef.current) {
        isSwitchingRef.current = false;
        // startCamera will be triggered by the useEffect watching selectedCameraIndex
      }
    } catch (err) {
      console.error('handleSwitchCamera error:', err);
      isSwitchingRef.current = false;
      if (mountedRef.current) {
        setErrorMsg('Camera switch failed. Try again.');
        setStatus('error');
      }
    }
  }, [cameras, selectedCameraIndex, stopCamera]);

  // Mount effect - init cameras
  useEffect(() => {
    mountedRef.current = true;
    initCameras();

    return () => {
      console.log('QRScanner unmounting...');
      mountedRef.current = false;
      
      // Synchronous cleanup on unmount
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch (e) { /* ignore */ }
        controlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [initCameras]);

  // Start scanning when cameras are loaded
  useEffect(() => {
    if (cameras.length > 0 && status === 'loading') {
      console.log('Auto-starting scanner...');
      startCamera();
    }
  }, [cameras.length, status, startCamera]);

  // Effect to restart after camera switch
  useEffect(() => {
    // Skip if no cameras, paused, or still switching
    if (cameras.length === 0 || status === 'paused' || status === 'loading') return;
    if (isSwitchingRef.current) return;
    
    // Small delay to allow state to settle
    const timer = setTimeout(() => {
      if (mountedRef.current && !isStoppingRef.current && !isSwitchingRef.current) {
        console.log('Camera index changed, restarting scanner...');
        startCamera();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  // Only run when selectedCameraIndex changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraIndex]);

  // Visibility change handler
  useEffect(() => {
    let wasScanning = false;

    const handleVisibility = async () => {
      if (document.hidden) {
        wasScanning = status === 'scanning' || status === 'success';
        if (wasScanning) {
          console.log('Tab hidden, stopping camera');
          await stopCamera();
          if (mountedRef.current) setStatus('paused');
        }
      } else {
        if (wasScanning && mountedRef.current) {
          console.log('Tab visible, resuming camera');
          setTimeout(() => {
            if (mountedRef.current) startCamera();
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [status, stopCamera, startCamera]);

  // Loading state
  if (status === 'loading' && cameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-xl">
        <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
        <p className="text-gray-300">Initializing camera...</p>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-xl">
        <CameraOff className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 font-semibold mb-2">Camera Error</p>
        <p className="text-gray-400 text-sm text-center mb-4">{errorMsg}</p>
        <button
          onClick={initCameras}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  const isActive = status === 'scanning' || status === 'success';

  return (
    <div className="flex flex-col gap-4">
      {/* Scanner */}
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Paused overlay */}
        {status === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90">
            <div className="text-center">
              <CameraOff className="w-16 h-16 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">Scanner paused</p>
            </div>
          </div>
        )}

        {/* Success overlay */}
        {status === 'success' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
            <div className="text-center animate-pulse">
              <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-bold text-lg">Scanned!</p>
            </div>
          </div>
        )}

        {/* Duplicate warning overlay */}
        {duplicateWarning && (
          <div className="absolute inset-0 flex items-center justify-center bg-yellow-500/20 backdrop-blur-sm">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-3" />
              <p className="text-yellow-400 font-bold">{duplicateWarning}</p>
            </div>
          </div>
        )}

        {/* Target frame */}
        {isActive && status !== 'success' && !duplicateWarning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-48 h-48">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
              <div className="absolute inset-x-0 h-0.5 bg-blue-400 animate-scan-line"></div>
              <div className="absolute inset-0 border-2 border-dashed border-blue-400/50 rounded-lg"></div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-sm text-gray-400 truncate">
          {cameras[selectedCameraIndex]?.label || 'Camera'}
        </div>
        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <button
              onClick={handleSwitchCamera}
              disabled={isSwitchingRef.current}
              className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg"
              title="Switch camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={isActive ? handlePause : handleResume}
            className={`flex items-center justify-center w-10 h-10 rounded-lg text-white ${
              isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
            title={isActive ? 'Pause' : 'Resume'}
          >
            {isActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-sm text-gray-400 text-center">
        {status === 'success' 
          ? `Scanned: ${lastScanned?.substring(0, 20)}...`
          : "Point the camera at an employer's QR code to scan"}
      </p>

      {/* Session info */}
      {scannedCount > 0 && (
        <p className="text-xs text-gray-500 text-center">
          {scannedCount} employer{scannedCount > 1 ? 's' : ''} scanned this session
        </p>
      )}
    </div>
  );
}
