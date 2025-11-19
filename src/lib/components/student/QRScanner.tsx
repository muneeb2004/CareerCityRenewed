// Prompt for Copilot: "Create React component for QR code scanning using html5-qrcode with camera permissions, decode employer QR, and check duplicate visits"

'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { checkIfVisited } from '../../firestore/student';
import { getStudentSession } from '../../storage';
import toast from 'react-hot-toast';

interface QRScannerProps {
  onScanSuccess: (employerId: string) => void;
}

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        onScanError
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Camera access denied or unavailable');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    // Assuming QR code contains: employer_id
    const employerId = decodedText;

    // Check for duplicate visit
    const session = getStudentSession();
    if (session) {
      const alreadyVisited = await checkIfVisited(session.studentId, employerId);
      if (alreadyVisited) {
        toast.error('You have already visited this stall!');
        return;
      }
    }

    if (typeof onScanSuccess === 'function') {
      onScanSuccess(employerId);
    }
  };

  const onScanError = (errorMessage: string) => {
    // Ignore scan errors (happens when no QR in view)
  };

  return (
    <div className="w-full">
      <div id="qr-reader" className="w-full rounded-lg overflow-hidden"></div>
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      <div className="mt-4 text-center">
        <p className="text-gray-600">Point your camera at an employer's QR code</p>
      </div>
    </div>
  );
}