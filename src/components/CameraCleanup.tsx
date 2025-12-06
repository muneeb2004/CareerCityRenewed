'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Global camera cleanup utility - stops all camera streams
export function stopAllCameraStreams() {
  // Stop all video element streams
  document.querySelectorAll('video').forEach(video => {
    try {
      const stream = video.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }
      video.srcObject = null;
      video.remove();
    } catch (e) {
      // Ignore errors
    }
  });

  // Clear QR reader container if it exists
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
      stopAllCameraStreams();
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
