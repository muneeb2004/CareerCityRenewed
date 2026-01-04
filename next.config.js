/**
 * Converted from next.config.ts
 * Keep the same configuration options here.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
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
    return config;
  },
};

module.exports = nextConfig;
