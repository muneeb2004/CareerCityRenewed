// Prompt for Copilot: "Create React component to generate QR code using qrcode.react for employer ID with download button"

'use client';

import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Organization } from '../../types';

interface QRCodeGeneratorProps {
  organization: Organization;
}

export default function QRCodeGenerator({ organization }: QRCodeGeneratorProps) {
  const qrRef = useRef<SVGSVGElement>(null);

  const downloadQR = useCallback(() => {
    if (!qrRef.current) return;

    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${organization.name}-QR.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  }, [organization.name]);

  return (
    <div className="flex flex-col items-center gap-3 group/qr">
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
        <QRCodeSVG
            ref={qrRef}
            id={`qr-${organization.organizationId}`}
            value={organization.organizationId}
            size={180}
            level="H"
            includeMargin
        />
      </div>

      <button
        onClick={downloadQR}
        className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover/qr:opacity-100 transition-opacity duration-200 bg-blue-50 px-3 py-1.5 rounded-full"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Download PNG
      </button>
    </div>
  );
}
