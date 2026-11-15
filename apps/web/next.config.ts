import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@beacon-watch/domain'],
  serverExternalPackages: ['pg', '@beacon-watch/db'],
  allowedDevOrigins: ['127.0.0.1'],
  agentRules: false,
};

export default nextConfig;
