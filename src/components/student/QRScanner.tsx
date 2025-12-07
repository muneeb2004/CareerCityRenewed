'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Loader2, CheckCircle } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'paused' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const mountedRef = useRef(true);
  const scanCooldownRef = useRef(false);
  const isStoppingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null); // Track last scanned to prevent duplicates

  // Filter out ultrawide/telephoto cameras
  const isMainCamera = (label: string): boolean => {
    const l = label.toLowerCase();
    return !l.includes('ultra') && !l.includes('wide') && !l.includes('tele') && 
           !l.includes('zoom') && !l.includes('macro') && !l.includes('depth');
  };

  // STOP camera - the critical function
  const stopCamera = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    
    console.log('stopCamera: Starting cleanup...');

    // 1. Stop ZXing controls FIRST - this is the most important
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        console.log('stopCamera: ZXing controls stopped');
      } catch (e) {
        console.log('stopCamera: ZXing stop error:', e);
      }
      controlsRef.current = null;
    }

    // 2. Stop the video element's stream
    if (videoRef.current) {
      const video = videoRef.current;
      
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log('stopCamera: Stopping track:', track.label, track.readyState);
          track.stop();
        });
        video.srcObject = null;
      }
      
      video.pause();
      video.src = '';
      video.load();
    }

    // 3. Wait a tick for browser to release
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 4. Reset scan tracking refs
    scanCooldownRef.current = false;
    lastScannedCodeRef.current = null;
    
    isStoppingRef.current = false;
    console.log('stopCamera: Cleanup complete');
  }, []);

  // Initialize cameras
  const initCameras = useCallback(async () => {
    try {
      setStatus('loading');
      setErrorMsg(null);

      // Get permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());

      // Get cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      const allCams: CameraDevice[] = videoDevices.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${i + 1}`
      }));

      const mainCams = allCams.filter(c => isMainCamera(c.label));
      const cams = mainCams.length > 0 ? mainCams : allCams;

      if (cams.length === 0) throw new Error('No cameras found');

      // Find back camera
      const backIdx = cams.findIndex(c => {
        const l = c.label.toLowerCase();
        return l.includes('back') || l.includes('rear') || l.includes('environment');
      });

      if (mountedRef.current) {
        setCameras(cams);
        setSelectedCameraIndex(backIdx >= 0 ? backIdx : 0);
      }
    } catch (err) {
      if (mountedRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'Camera error');
        setStatus('error');
        onError?.(err instanceof Error ? err.message : 'Camera error');
      }
    }
  }, [onError]);

  // Start scanning
  const startCamera = useCallback(async () => {
    if (!videoRef.current || cameras.length === 0 || !mountedRef.current) return;
    if (isStoppingRef.current) return; // Don't start while stopping

    const cam = cameras[selectedCameraIndex];
    if (!cam) return;

    console.log('startCamera: Starting with camera:', cam.label);

    try {
      // Make sure we're clean first
      await stopCamera();

      if (!mountedRef.current) return;

      // Import ZXing
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      
      if (!mountedRef.current) return;

      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 3000, // 3 second cooldown at library level
      });

      const controls = await reader.decodeFromVideoDevice(
        cam.deviceId,
        videoRef.current,
        (result, error) => {
          if (!mountedRef.current) return;

          // Skip if cooldown is active (using ref to avoid closure issues)
          if (result && !scanCooldownRef.current) {
            const code = result.getText();
            
            // Skip if this is the same code we just scanned
            if (code === lastScannedCodeRef.current) {
              return;
            }
            
            // Set cooldown and track code immediately
            scanCooldownRef.current = true;
            lastScannedCodeRef.current = code;
            
            setLastScanned(code);
            setStatus('success');

            if (navigator.vibrate) navigator.vibrate(100);
            onScan(code);

            // Reset after 3 seconds
            setTimeout(() => {
              if (mountedRef.current) {
                scanCooldownRef.current = false;
                lastScannedCodeRef.current = null;
                setLastScanned(null);
                setStatus('scanning');
              }
            }, 3000);
          }

          if (error && error.name !== 'NotFoundException') {
            console.log('Scan error:', error.message);
          }
        }
      );

      // Store controls for later cleanup
      controlsRef.current = controls;
      
      if (mountedRef.current) {
        setStatus('scanning');
        console.log('startCamera: Now scanning');
      }
    } catch (err) {
      console.error('startCamera error:', err);
      if (mountedRef.current) {
        setErrorMsg('Failed to start scanner');
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

  // Mount effect - init cameras
  useEffect(() => {
    mountedRef.current = true;
    initCameras();

    return () => {
      console.log('QRScanner unmounting...');
      mountedRef.current = false;
      // Synchronously stop on unmount
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch (e) { /* ignore */ }
        controlsRef.current = null;
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
      startCamera();
    }
  }, [cameras.length, status, startCamera]);

  // Handle camera switch
  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;
    
    await stopCamera();
    setSelectedCameraIndex(i => (i + 1) % cameras.length);
  }, [cameras.length, stopCamera]);

  // Effect to restart after camera switch
  useEffect(() => {
    if (status === 'paused' && cameras.length > 0) {
      // Don't auto-restart if user manually paused
      return;
    }
    if (cameras.length > 0 && (status === 'scanning' || status === 'success')) {
      // Camera index changed while scanning - restart
      // But only if we're not in the middle of stopping
      const timer = setTimeout(() => {
        if (mountedRef.current && !isStoppingRef.current) {
          startCamera();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraIndex]);

  // Visibility change
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
          }, 300);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [status, stopCamera, startCamera]);

  // Loading
  if (status === 'loading' && cameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-xl">
        <Loader2 className="w-12 h-12 animate-spin text-blue-400 mb-4" />
        <p className="text-gray-300">Initializing camera...</p>
      </div>
    );
  }

  // Error
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

        {/* Target frame */}
        {isActive && status !== 'success' && (
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
              className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
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
    </div>
  );
}
