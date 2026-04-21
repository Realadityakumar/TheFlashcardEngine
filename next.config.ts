import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  turbopack: {
    root: './',
  },
};

export default nextConfig;
