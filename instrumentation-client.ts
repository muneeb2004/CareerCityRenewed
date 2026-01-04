import * as Sentry from '@sentry/nextjs';

// Client-side Sentry initialization
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay (optional - captures user sessions on errors)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Disable in development if no DSN
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Integrations
  integrations: [
    Sentry.replayIntegration(),
  ],
  
  // Filter out non-error events in development
  beforeSend(event) {
    if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return null;
    }
    return event;
  },
});

// Export for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
