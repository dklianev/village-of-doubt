import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const privateGameRouteSources = [
  "/mafia/create",
  "/mafia/join/:path*",
  "/werewolf/create",
  "/werewolf/join/:path*",
] as const;

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Next 16.3 standalone tracing drops the module-sync branch of @swc/helpers from pnpm
  // standalone traces. Remove after vercel/next.js#97372 reaches stable.
  outputFileTracingIncludes: {
    "/*": ["../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/esm/**/*"],
  },
  cacheComponents: true,
  transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/game-art/**", search: "?v=2" },
      { pathname: "/game-art/**", search: "?v=3" },
    ],
    qualities: [75, 85],
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1536, 1920, 2048, 3840],
  },
  experimental: {
    instrumentationClientRouterTransitionEvents: true,
    // Reduce unrelated route CSS in shared chunks; keep perf:budget and browser checks.
    cssChunking: "graph",
    // Keep shared client code reusable across routes; measured with perf:budget.
    turbopackChunking: { minChunkSize: 40000 },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      ...privateGameRouteSources.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

const canUploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN
    ? { authToken: process.env.SENTRY_AUTH_TOKEN }
    : {}),
  silent: !process.env.CI,
  telemetry: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
      excludeReplayCompressionWorker: true,
    },
  },
  ...(process.env.RELEASE_VERSION
    ? { release: { name: process.env.RELEASE_VERSION } }
    : {}),
  sourcemaps: {
    disable: !canUploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
});
