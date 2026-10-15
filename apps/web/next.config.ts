import path from 'node:path';
import type { NextConfig } from 'next';

// Set only by the Docker build (apps/web/Dockerfile). The image is a self-contained server, and
// /api/v1 on the web origin is forwarded to the API container, so the browser needs one port only.
const apiProxyTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  transpilePackages: ['@sakan/shared'],
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true' && {
    output: 'standalone',
    outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  }),
  async rewrites() {
    return apiProxyTarget ? [{ source: '/api/v1/:path*', destination: `${apiProxyTarget}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
