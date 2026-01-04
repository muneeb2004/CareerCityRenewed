'use client';

import { useEffect, useRef } from 'react';
import { initWebVitals, WebVitalMetric } from '@/lib/web-vitals';

interface WebVitalsReporterProps {
  /** Custom callback for metrics - useful for sending to analytics */
  onMetric?: (metric: WebVitalMetric) => void;
  /** Report all changes, not just final values */
  reportAllChanges?: boolean;
}

/**
 * Client component that initializes Web Vitals tracking
 * Add this to your root layout to start monitoring performance
 * 
 * @example
 * ```tsx
 * // In app/layout.tsx
 * import { WebVitalsReporter } from '@/lib/components/ui/WebVitalsReporter';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <WebVitalsReporter />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function WebVitalsReporter({ 
  onMetric, 
  reportAllChanges = false 
}: WebVitalsReporterProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (initialized.current) return;
    initialized.current = true;

    initWebVitals({
      onMetric,
      reportAllChanges,
    });
  }, [onMetric, reportAllChanges]);

  // This component doesn't render anything
  return null;
}

/**
 * Hook to collect Web Vitals metrics
 * Returns an array of collected metrics that updates over time
 */
export function useWebVitals() {
  const metricsRef = useRef<WebVitalMetric[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    initWebVitals({
      onMetric: (metric) => {
        metricsRef.current = [...metricsRef.current, metric];
      },
    });
  }, []);

  return metricsRef.current;
}
