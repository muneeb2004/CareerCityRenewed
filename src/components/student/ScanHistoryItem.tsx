'use client';

import React from 'react';
import { Scan } from '@/types';

interface ScanHistoryItemProps {
  scan: Scan;
  mounted: boolean;
}

/**
 * Memoized ScanHistoryItem component for scan history lists.
 * Only re-renders when scan data changes.
 */
export const ScanHistoryItem = React.memo(function ScanHistoryItem({
  scan,
  mounted,
}: ScanHistoryItemProps) {
  const timestamp = new Date(scan.timestamp as unknown as string);
  
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md hover:border-blue-300 transition-all duration-200">
      <div>
        <p className="font-bold text-gray-900 text-lg">
          {scan.organizationName}
        </p>
        <p className="text-sm text-blue-700 font-medium bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md inline-block mt-1">
          Booth: {scan.boothNumber}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {mounted && timestamp.toLocaleDateString()}
        </p>
        <p className="text-sm font-bold text-gray-700">
          {mounted && timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if scan data changes
  return (
    prevProps.scan.scanId === nextProps.scan.scanId &&
    prevProps.scan.organizationName === nextProps.scan.organizationName &&
    prevProps.scan.boothNumber === nextProps.scan.boothNumber &&
    prevProps.scan.timestamp === nextProps.scan.timestamp &&
    prevProps.mounted === nextProps.mounted
  );
});

export default ScanHistoryItem;
