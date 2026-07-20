import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
