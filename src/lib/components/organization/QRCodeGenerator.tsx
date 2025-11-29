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

    <div className="bg-white p-6 rounded-lg shadow-lg text-center">

      <h3 className="text-xl font-bold mb-2">{organization.name}</h3>

      <p className="text-gray-600 mb-4">Booth {organization.boothNumber}</p>



      <div className="flex justify-center mb-4">

        <QRCodeSVG

          ref={qrRef}

          id={`qr-${organization.organizationId}`}

          value={organization.organizationId}

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
