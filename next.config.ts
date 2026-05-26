import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    ".space-z.ai",
    "preview-chat-eb9979e5-af36-4c73-b061-c090bdb3e51f.space-z.ai",
  ],
};

export default nextConfig;
