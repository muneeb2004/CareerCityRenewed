'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, RefreshCw, Loader2, CheckCircle, AlertTriangle, Flashlight, FlashlightOff } from 'lucide-react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { haptics } from '../../lib/haptics';

const DEBUG_SCANNER = process.env.NODE_ENV === 'development';
const log = (...args: unknown[]) => DEBUG_SCANNER && console.log('[QRScanner]', ...args);

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  alreadyScannedIds?: string[];
}

interface CameraDevice {
  deviceId: string;
  label: string;
  score: number;
}

export default function QRScanner({ onScan, onError, alreadyScannedIds = [] }: QRScannerProps) {
  const alreadyScannedRef = useRef(new Set<string>(alreadyScannedIds));
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'paused' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  
  // Torch state
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCooldownRef = useRef(false);
  
  // Lifecycle & Concurrency Management
  const mountIdRef = useRef<string>('');
  const isMountedRef = useRef(false);
  const isCleaningUpRef = useRef(false);

  // Initialize reader once
  useEffect(() => {
    if (!readerRef.current) {
      readerRef.current = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 150, 
        delayBetweenScanSuccess: 3000,
      });
    }
  }, []);

  useEffect(() => {
    alreadyScannedIds.forEach(id => alreadyScannedRef.current.add(id));
  }, [alreadyScannedIds]);

  const scoreCameraForQR = (label: string): number => {
    const l = label.toLowerCase();
    let score = 50;
    if (l.includes('ultra') || l.includes('wide angle') || l.includes('ultrawide')) score -= 100;
    if (l.includes('tele') || l.includes('zoom') || l.includes('telephoto')) score -= 100;
    if (l.includes('macro')) score -= 100;
    if (l.includes('depth') || l.includes('tof')) score -= 100;
    if (l.includes('front') || l.includes('selfie')) score -= 80;
    if (l.includes('ir') || l.includes('infrared')) score -= 100;
    if (l.includes('back') || l.includes('rear')) score += 30;
    if (l.includes('main') || l.includes('primary')) score += 40;
    if (l.includes('wide') && !l.includes('ultra')) score += 20;
    if (l.includes('camera 0') || l.includes('camera0')) score += 25;
    if (l.includes('environment')) score += 20;
    if (l.includes('camera2 0')) score += 30;
    return score;
  };

  const stopCamera = useCallback(async () => {
    log('stopCamera: Cleanup starting...');

    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
        log('stopCamera: Controls stopped.');
      } catch (e) { /* ignore */ }
      controlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          log(`stopCamera: Track ${track.label} stopped.`);
        } catch (e) { /* ignore */ }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }

    setHasTorch(false);
    setIsTorchOn(false);
    scanCooldownRef.current = false;
    
    // Wait briefly for hardware release
    await new Promise(resolve => setTimeout(resolve, 150));
    log('stopCamera: Cleanup done');
  }, []);

  const initCameras = useCallback(async (currentMountId: string) => {
    // Early exit if not mounted or mount ID changed
    if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
      log(`initCameras: Skipping - stale mount (${currentMountId} vs ${mountIdRef.current})`);
      return;
    }
    
    try {
      log(`initCameras: Starting (Mount: ${currentMountId})...`);
      
      // Explicitly ask for environment camera permission first
      try {
        log('initCameras: Requesting permissions...');
        const permStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        log('initCameras: Permissions granted.');
        permStream.getTracks().forEach(t => t.stop());
      } catch (e) {
        log('initCameras: Permission check failed/fallback:', e);
      }

      // Check again after async operation
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
        log('initCameras: Aborted after permission request');
        return;
      }

      log('initCameras: Enumerating devices...');
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Check again after async operation
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
        log('initCameras: Aborted after device enumeration');
        return;
      }
      
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      log(`initCameras: Found ${videoDevices.length} video devices.`);

      if (videoDevices.length === 0) throw new Error('No cameras found on this device.');

      const scoredCams: CameraDevice[] = videoDevices.map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${i + 1}`,
        score: scoreCameraForQR(d.label || '')
      }));

      scoredCams.sort((a, b) => b.score - a.score);
      const mainCams = scoredCams.filter(c => c.score > 0);
      const camsToUse = mainCams.length > 0 ? mainCams : scoredCams;

      if (isMountedRef.current && currentMountId === mountIdRef.current) {
        log('initCameras: Setting cameras state.');
        setCameras(camsToUse);
        setSelectedCameraIndex(0);
      }
    } catch (err) {
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) return;
      log('initCameras error:', err);
      
      let msg = 'Camera error';
      if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') msg = 'Camera permission denied. Please allow access in settings.';
          if (err.name === 'NotFoundError') msg = 'No camera device found.';
          if (err.name === 'NotReadableError') msg = 'Camera is in use by another app.';
      } else if (err instanceof Error) {
          msg = err.message;
      }
      setErrorMsg(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [onError]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !isMountedRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const newState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: newState }]
      } as any);
      if (isMountedRef.current) {
        setIsTorchOn(newState);
      }
    } catch (e) {
      log('Error toggling torch:', e);
    }
  }, [isTorchOn]);

  const startCamera = useCallback(async (currentMountId: string) => {
    // Early exit checks
    if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
      log('startCamera: Skipping - stale mount');
      return;
    }
    
    if (!videoRef.current || cameras.length === 0) {
      log('startCamera: Prerequisites not met.');
      return;
    }

    // Prevent concurrent camera operations
    if (isCleaningUpRef.current) {
      log('startCamera: Cleanup in progress, skipping');
      return;
    }

    const cam = cameras[selectedCameraIndex];
    if (!cam) return;

    // Optimization: If stream is already active with same device, don't restart
    if (streamRef.current && videoRef.current && videoRef.current.srcObject) {
        const activeTrack = streamRef.current.getVideoTracks()[0];
        if (activeTrack && activeTrack.readyState === 'live') {
          const currentDeviceId = activeTrack.getSettings().deviceId;
          if (currentDeviceId === cam.deviceId) {
             log('startCamera: Camera already active with correct device, skipping restart.');
             if (isMountedRef.current && currentMountId === mountIdRef.current) setStatus('scanning');
             return;
          }
        }
    }

    log(`startCamera: Starting ${cam.label} (Mount: ${currentMountId})`);

    try {
      isCleaningUpRef.current = true;
      await stopCamera();
      isCleaningUpRef.current = false;
      
      // Check mount status after cleanup
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
        log('startCamera: Aborted after cleanup');
        return;
      }

      log('startCamera: getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: cam.deviceId },
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30 }
        }
      });
      
      // Check mount status after getUserMedia
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
          log('startCamera: Aborted after getUserMedia - cleaning up stream');
          stream.getTracks().forEach(t => t.stop());
          return;
      }

      log('startCamera: Stream obtained.');
      streamRef.current = stream;
      
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      setHasTorch(!!capabilities?.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
            if (videoRef.current) {
                videoRef.current.onloadedmetadata = () => resolve();
                videoRef.current.onerror = (e) => reject(e);
            } else {
                reject(new Error('Video element lost'));
            }
        });
      }

      // Check mount status after video loaded
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) {
        log('startCamera: Aborted after video loaded');
        return;
      }

      log('startCamera: Starting decoder...');
      if (!readerRef.current) {
          readerRef.current = new BrowserQRCodeReader(undefined, {
            delayBetweenScanAttempts: 150,
            delayBetweenScanSuccess: 3000
          });
      }

      controlsRef.current = await readerRef.current.decodeFromVideoElement(
        videoRef.current!,
        (result, error) => {
          // Use refs instead of closure values for freshness
          if (!isMountedRef.current || mountIdRef.current !== currentMountId) return;
          
          if (result) {
            const code = result.getText();
            if (scanCooldownRef.current) return;

            if (alreadyScannedRef.current.has(code)) {
              setDuplicateWarning('Already visited this employer!');
              haptics.warning(); // Haptic feedback for duplicate
              setTimeout(() => { 
                  if (isMountedRef.current && mountIdRef.current === currentMountId) {
                    setDuplicateWarning(null);
                  }
              }, 2000);
              return;
            }

            log('Valid scan:', code);
            scanCooldownRef.current = true;
            alreadyScannedRef.current.add(code);
            setScannedCount(alreadyScannedRef.current.size);
            
            setLastScanned(code);
            setStatus('success');
            
            // Premium haptic feedback for successful scan
            haptics.success();
            
            onScan(code);

            setTimeout(() => {
              if (isMountedRef.current && mountIdRef.current === currentMountId) {
                scanCooldownRef.current = false;
                setLastScanned(null);
                setStatus('scanning');
              }
            }, 4000);
          }
        }
      );
      log('startCamera: Decoder started.');

      if (isMountedRef.current && currentMountId === mountIdRef.current) {
        setStatus('scanning');
      }
    } catch (err) {
      isCleaningUpRef.current = false;
      if (!isMountedRef.current || currentMountId !== mountIdRef.current) return;
      log('startCamera error:', err);
      
      let msg = 'Failed to start camera.';
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
          msg = 'Permission denied. Please reset permissions and try again.';
      }
      setErrorMsg(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [cameras, selectedCameraIndex, onScan, stopCamera, onError]);

  // Main Lifecycle
  useEffect(() => {
    // 1. Setup Mount ID and mounted flag
    const myMountId = Math.random().toString(36).substring(7);
    mountIdRef.current = myMountId;
    isMountedRef.current = true;
    isCleaningUpRef.current = false;
    log(`QRScanner: Mounted (ID: ${myMountId})`);

    // 2. Initialize cameras after a brief delay to avoid React Strict Mode race
    const initTimer = setTimeout(() => {
      if (isMountedRef.current && mountIdRef.current === myMountId) {
        initCameras(myMountId);
      }
    }, 50);

    return () => {
      log(`QRScanner: Unmounting (ID: ${myMountId})`);
      // 3. Immediately mark as unmounted to stop all in-flight operations
      isMountedRef.current = false;
      mountIdRef.current = '';
      
      clearTimeout(initTimer);

      // 4. Synchronous cleanup of camera resources
      if (controlsRef.current) {
        try {
          controlsRef.current.stop();
        } catch (e) { /* ignore */ }
        controlsRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) { /* ignore */ }
        });
        streamRef.current = null;
      }
    };
  }, [initCameras, stopCamera]);

  // Camera Switch / Start Effect
  useEffect(() => {
    const myMountId = mountIdRef.current;
    if (!myMountId || !isMountedRef.current) return;

    if (cameras.length > 0) {
        // Debounce to allow state to settle and avoid rapid restarts
        const timer = setTimeout(() => {
            if (isMountedRef.current && mountIdRef.current === myMountId) {
                startCamera(myMountId);
            }
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [selectedCameraIndex, cameras.length, startCamera]);

  const handleSwitchCamera = () => {
    if (cameras.length < 2 || !isMountedRef.current) return;
    const nextIdx = (selectedCameraIndex + 1) % cameras.length;
    setSelectedCameraIndex(nextIdx);
  };

  const handlePauseResume = async () => {
    if (!isMountedRef.current) return;
    
    if (status === 'paused') {
      await startCamera(mountIdRef.current);
    } else {
      await stopCamera();
      if (isMountedRef.current) setStatus('paused');
    }
  };

  if (status === 'loading' && cameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-gray-100 rounded-xl border border-gray-200">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-3" />
        <p className="text-gray-500 font-medium">Starting Camera...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-xl border border-red-100 text-center">
        <CameraOff className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-red-700 font-bold mb-1">Camera Error</p>
        <p className="text-red-600 text-sm mb-4 max-w-xs">{errorMsg}</p>
        <button
          onClick={() => {
              if (isMountedRef.current) {
                initCameras(mountIdRef.current);
              }
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  const isActive = status === 'scanning' || status === 'success';

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full aspect-square sm:aspect-4/3 overflow-hidden rounded-2xl bg-black shadow-inner ring-1 ring-black/10">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {status === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm text-white">
            <CameraOff className="w-12 h-12 mb-3 opacity-80" />
            <p className="font-medium opacity-90">Scanner Paused</p>
          </div>
        )}

        {status === 'success' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/90 backdrop-blur-sm text-white animate-in fade-in duration-200">
            <CheckCircle className="w-16 h-16 mb-2 drop-shadow-md" />
            <p className="text-xl font-bold drop-shadow-sm">Scanned!</p>
          </div>
        )}

        {duplicateWarning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-500/90 backdrop-blur-sm text-white animate-in fade-in duration-200">
            <AlertTriangle className="w-16 h-16 mb-2 drop-shadow-md" />
            <p className="text-lg font-bold drop-shadow-sm">{duplicateWarning}</p>
          </div>
        )}

        {isActive && !duplicateWarning && status !== 'success' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 border-40 border-black/30"></div>
            <div className="absolute top-10 left-10 w-8 h-8 border-t-4 border-l-4 border-white/80 rounded-tl-lg drop-shadow-sm"></div>
            <div className="absolute top-10 right-10 w-8 h-8 border-t-4 border-r-4 border-white/80 rounded-tr-lg drop-shadow-sm"></div>
            <div className="absolute bottom-10 left-10 w-8 h-8 border-b-4 border-l-4 border-white/80 rounded-bl-lg drop-shadow-sm"></div>
            <div className="absolute bottom-10 right-10 w-8 h-8 border-b-4 border-r-4 border-white/80 rounded-br-lg drop-shadow-sm"></div>
            <div className="absolute top-10 left-10 right-10 h-0.5 bg-blue-400/80 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-scan-line"></div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 min-w-0 mr-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Active Camera</p>
            <p className="text-sm font-medium text-gray-900 truncate">
                {cameras[selectedCameraIndex]?.label || 'Unknown Camera'}
            </p>
        </div>

        <div className="flex items-center gap-2">
            {hasTorch && isActive && (
                <button
                    onClick={toggleTorch}
                    className={`p-3 rounded-xl transition-all ${
                        isTorchOn 
                        ? 'bg-amber-100 text-amber-600 shadow-inner' 
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                    title="Toggle Flashlight"
                >
                    {isTorchOn ? <Flashlight className="w-5 h-5 fill-current" /> : <FlashlightOff className="w-5 h-5" />}
                </button>
            )}

            {cameras.length > 1 && (
                <button
                    onClick={handleSwitchCamera}
                    className="p-3 bg-white text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors shadow-sm"
                    title="Switch Camera"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            )}

            <button
                onClick={handlePauseResume}
                className={`p-3 rounded-xl text-white shadow-sm transition-all active:scale-95 ${
                    isActive 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                }`}
                title={isActive ? 'Pause Scanner' : 'Resume Scanner'}
            >
                {isActive ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
            </button>
        </div>
      </div>

      {scannedCount > 0 && (
        <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                <CheckCircle className="w-3 h-3" />
                {scannedCount} scan{scannedCount !== 1 && 's'} this session
            </span>
        </div>
      )}
    </div>
  );
}
