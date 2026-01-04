'use client';

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/**
 * Web Vitals metric names
 * - CLS: Cumulative Layout Shift (visual stability)
 * - FCP: First Contentful Paint (initial render)
 * - INP: Interaction to Next Paint (replaces FID in 2024)
 * - LCP: Largest Contentful Paint (loading performance)
 * - TTFB: Time to First Byte (server response time)
 */
export type MetricName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB';

export interface WebVitalMetric {
  name: MetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * Thresholds for each metric based on Google's recommendations
 * [good, poor] - values between are "needs improvement"
 */
const thresholds: Record<MetricName, [number, number]> = {
  CLS: [0.1, 0.25],           // Cumulative Layout Shift (unitless)
  FCP: [1800, 3000],          // First Contentful Paint (ms)
  INP: [200, 500],            // Interaction to Next Paint (ms)
  LCP: [2500, 4000],          // Largest Contentful Paint (ms)
  TTFB: [800, 1800],          // Time to First Byte (ms)
};

/**
 * Get performance rating based on metric value
 */
function getRating(name: MetricName, value: number): WebVitalMetric['rating'] {
  const [good, poor] = thresholds[name];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Format metric value for display
 */
function formatValue(name: MetricName, value: number): string {
  if (name === 'CLS') {
    return value.toFixed(3);
  }
  return `${Math.round(value)}ms`;
}

/**
 * Default metric handler - logs to console with color coding
 */
function defaultOnMetric(metric: WebVitalMetric): void {
  const colors = {
    good: 'color: #0cce6b; font-weight: bold',
    'needs-improvement': 'color: #ffa400; font-weight: bold',
    poor: 'color: #ff4e42; font-weight: bold',
  };

  console.log(
    `%c[Web Vital] ${metric.name}: ${formatValue(metric.name, metric.value)} (${metric.rating})`,
    colors[metric.rating]
  );
}

/**
 * Send metrics to analytics endpoint
 */
async function sendToAnalytics(metric: WebVitalMetric): Promise<void> {
  // You can customize this to send to your analytics service
  // For now, we'll use navigator.sendBeacon for reliability
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
    return;
  }

  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    timestamp: Date.now(),
  });

  // Uncomment to send to your analytics endpoint:
  // navigator.sendBeacon('/api/analytics/web-vitals', body);
  
  // For debugging, log the payload
  if (process.env.NODE_ENV === 'development') {
    console.debug('[Web Vitals Analytics]', JSON.parse(body));
  }
}

/**
 * Create metric handler from web-vitals Metric
 */
function createMetricHandler(
  name: MetricName,
  onMetric?: (metric: WebVitalMetric) => void
) {
  return (metric: Metric) => {
    const webVitalMetric: WebVitalMetric = {
      name,
      value: metric.value,
      rating: getRating(name, metric.value),
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType || 'unknown',
    };

    // Call custom handler if provided
    onMetric?.(webVitalMetric);

    // Always log in development
    if (process.env.NODE_ENV === 'development') {
      defaultOnMetric(webVitalMetric);
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      sendToAnalytics(webVitalMetric);
    }
  };
}

export interface WebVitalsOptions {
  /** Custom callback for each metric */
  onMetric?: (metric: WebVitalMetric) => void;
  /** Whether to report all changes (not just final values) */
  reportAllChanges?: boolean;
}

/**
 * Initialize Web Vitals tracking
 * Call this once in your app's root component
 */
export function initWebVitals(options: WebVitalsOptions = {}): void {
  const { onMetric, reportAllChanges = false } = options;

  try {
    // Core Web Vitals
    onCLS(createMetricHandler('CLS', onMetric), { reportAllChanges });
    onLCP(createMetricHandler('LCP', onMetric), { reportAllChanges });
    onINP(createMetricHandler('INP', onMetric), { reportAllChanges });

    // Other Web Vitals
    onFCP(createMetricHandler('FCP', onMetric), { reportAllChanges });
    onTTFB(createMetricHandler('TTFB', onMetric), { reportAllChanges });

    console.log('[Web Vitals] Monitoring initialized');
  } catch (error) {
    console.error('[Web Vitals] Failed to initialize:', error);
  }
}

/**
 * Get a summary of current performance based on recorded metrics
 */
export function getPerformanceSummary(metrics: WebVitalMetric[]): {
  overall: 'good' | 'needs-improvement' | 'poor';
  details: Record<MetricName, WebVitalMetric | null>;
} {
  const details: Record<MetricName, WebVitalMetric | null> = {
    CLS: null,
    FCP: null,
    INP: null,
    LCP: null,
    TTFB: null,
  };

  // Get latest metric for each type
  for (const metric of metrics) {
    details[metric.name] = metric;
  }

  // Calculate overall score (poor if any metric is poor, good if all are good)
  const ratings = Object.values(details)
    .filter((m): m is WebVitalMetric => m !== null)
    .map((m) => m.rating);

  let overall: 'good' | 'needs-improvement' | 'poor' = 'good';
  if (ratings.includes('poor')) {
    overall = 'poor';
  } else if (ratings.includes('needs-improvement')) {
    overall = 'needs-improvement';
  }

  return { overall, details };
}
