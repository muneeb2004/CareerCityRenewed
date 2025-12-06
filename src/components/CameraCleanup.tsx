'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Global camera cleanup utility - AGGRESSIVELY stops all camera streams
export function stopAllCameraStreams() {
  console.log('[CameraCleanup] Stopping all camera streams');
  
  // Method 1: Stop all video element streams
  document.querySelectorAll('video').forEach(video => {
    try {
      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => {
          console.log('[CameraCleanup] Stopping track:', track.label, 'state:', track.readyState);
          track.stop();
        });
      }
      video.srcObject = null;
      video.remove();
    } catch (e) {
      console.log('[CameraCleanup] Error stopping video:', e);
    }
  });

  // Method 2: Clear QR reader container
  const container = document.getElementById('qr-reader');
  if (container) {
    container.innerHTML = '';
  }
  
  // Method 3: Try to stop any active media tracks via navigator
  if (navigator.mediaDevices) {
    try {
      // This gets all currently active streams - not supported in all browsers but worth trying
      (navigator.mediaDevices as any).getUserMedia({ video: true, audio: false })
        .then((stream: MediaStream) => {
          // Immediately stop any tracks we just got access to
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(() => {
          // Expected to fail if no camera permission, that's fine
        });
    } catch (e) {
      // Ignore
    }
  }
}

// Component that cleans up cameras on route change
export default function CameraCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    // Clean up cameras when route changes away from /student
    if (pathname !== '/student') {
      console.log('[CameraCleanup] Route changed to:', pathname, '- cleaning up cameras');
      // Run cleanup multiple times with delays to catch any stragglers
      stopAllCameraStreams();
      setTimeout(stopAllCameraStreams, 100);
      setTimeout(stopAllCameraStreams, 500);
    }
  }, [pathname]);

  // Also clean up on mount (in case navigated from student page)
  useEffect(() => {
    if (pathname !== '/student') {
      stopAllCameraStreams();
    }
    
    return () => {
      stopAllCameraStreams();
    };
  }, [pathname]);

  return null;
}
