import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Environment
      environment: process.env.NODE_ENV,
      
      // Disable in development if no DSN
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Environment
      environment: process.env.NODE_ENV,
      
      // Disable in development if no DSN
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }
}
