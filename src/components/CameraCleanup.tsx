'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Stop all camera streams on the page - aggressive version
function stopAllCameras() {
  console.log('CameraCleanup: Stopping all cameras');
  
  // Stop all video streams
  document.querySelectorAll('video').forEach(video => {
    try {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log('Stopping track:', track.label);
          track.stop();
        });
        video.srcObject = null;
      }
      video.src = '';
      video.load();
      video.pause();
    } catch (e) {
      console.log('Error stopping video:', e);
    }
  });
  
  console.log('CameraCleanup: Complete');
}

export default function CameraCleanup() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  // Track route changes
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    
    // If we navigated AWAY from /student, clean up cameras
    if (prev === '/student' && pathname !== '/student') {
      console.log('CameraCleanup: Navigated away from /student');
      // Delay slightly to ensure component unmount runs first
      setTimeout(stopAllCameras, 100);
    }
  }, [pathname]);

  // Clean up on page unload
  useEffect(() => {
    window.addEventListener('beforeunload', stopAllCameras);
    window.addEventListener('pagehide', stopAllCameras);

    return () => {
      window.removeEventListener('beforeunload', stopAllCameras);
      window.removeEventListener('pagehide', stopAllCameras);
    };
  }, []);

  return null;
}
