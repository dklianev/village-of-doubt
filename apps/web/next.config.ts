import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@werewolf/shared", "@werewolf/database"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
