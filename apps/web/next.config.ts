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
  // Next 16.3.1 drops the module-sync branch of @swc/helpers from pnpm
  // standalone traces. Remove after vercel/next.js#97372 reaches stable.
  outputFileTracingIncludes: {
    "/*": ["../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/esm/**/*"],
  },
  cacheComponents: true,
  transpilePackages: ["@werewolf/shared", "@werewolf/database", "@werewolf/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    instrumentationClientRouterTransitionEvents: true,
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
