// Prompt for Copilot: "Create React component to generate QR code using qrcode.react for employer ID with download button"

'use client';

import { QRCodeSVG } from 'qrcode.react';
import { Employer } from '../../types';

interface QRCodeGeneratorProps {
  employer: Employer;
}

export default function QRCodeGenerator({ employer }: QRCodeGeneratorProps) {
  const downloadQR = () => {
    const svg = document.getElementById(`qr-${employer.employerId}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${employer.name}-QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg text-center">
      <h3 className="text-xl font-bold mb-2">{employer.name}</h3>
      <p className="text-gray-600 mb-4">Booth {employer.boothNumber}</p>
      
      <div className="flex justify-center mb-4">
        <QRCodeSVG
          id={`qr-${employer.employerId}`}
          value={employer.employerId}
          size={256}
          level="H"
          includeMargin
        />
      </div>
      
      <button
        onClick={downloadQR}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        Download QR Code
      </button>
    </div>
  );
}