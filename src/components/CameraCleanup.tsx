'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Global camera cleanup utility
export function stopAllCameraStreams() {
  // Stop all video elements
  document.querySelectorAll('video').forEach(video => {
    try {
      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => {
          try { 
            track.stop(); 
            console.log('[CameraCleanup] Stopped track:', track.label);
          } catch (e) {}
        });
      }
      video.srcObject = null;
    } catch (e) {}
  });

  // Clear QR reader container if exists
  const container = document.getElementById('qr-reader');
  if (container) {
    container.innerHTML = '';
  }
}

// Component that cleans up cameras on route change
export default function CameraCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    // Clean up cameras when route changes away from /student
    if (pathname !== '/student') {
      console.log('[CameraCleanup] Route changed to:', pathname, '- cleaning up cameras');
      stopAllCameraStreams();
    }
  }, [pathname]);

  // Also clean up on mount (in case navigated from student page)
  useEffect(() => {
    if (pathname !== '/student') {
      stopAllCameraStreams();
    }
    
    // Cleanup on unmount
    return () => {
      stopAllCameraStreams();
    };
  }, []);

  return null;
}
