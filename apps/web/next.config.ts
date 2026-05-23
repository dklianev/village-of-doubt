import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
