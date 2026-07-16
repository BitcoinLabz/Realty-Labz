import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB; raised to comfortably fit scanned contract PDFs.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
