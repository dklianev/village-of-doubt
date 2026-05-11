import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@werewolf/shared", "@werewolf/database"],
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
