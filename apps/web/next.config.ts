import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Removed rewrites - using route handlers instead to forward auth tokens
  transpilePackages: ['@chronosops/contracts'],
};

export default nextConfig;
