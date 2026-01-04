/**
 * Converted from next.config.ts
 * Keep the same configuration options here.
 */

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Cache static assets (images, fonts, etc.)
      urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      // Cache API responses with network-first strategy
      urlPattern: /^https?:\/\/.*\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
    {
      // Cache page navigations
      urlPattern: /^https?:\/\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'page-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60, // 1 hour
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
  },
  
  // Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Enable browser XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires these
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.vercel.app https://*.mongodb.net wss://*.mongodb.net",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Permissions Policy - restrict browser features
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these Node.js modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        'mongodb-client-encryption': false,
        aws4: false,
        snappy: false,
        '@mongodb-js/zstd': false,
        kerberos: false,
        '@aws-sdk/credential-providers': false,
        'gcp-metadata': false,
        socks: false,
      };
    }
    
    // Suppress webpack cache serialization warnings for large strings
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: 'error',
    };
    
    return config;
  },
};

// Wrap with Sentry if available
const { withSentryConfig } = require('@sentry/nextjs');

const sentryConfig = {
  // Suppresses source map upload logs during build
  silent: true,
  
  // Upload source maps for better stack traces
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Only upload in production builds
  dryRun: process.env.NODE_ENV !== 'production' || !process.env.SENTRY_AUTH_TOKEN,
};

const sentryOptions = {
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  
  // Disables the Sentry SDK webpack plugin
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  
  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
};

module.exports = withSentryConfig(withPWA(nextConfig), sentryConfig, sentryOptions);
