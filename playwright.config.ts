import { defineConfig } from "playwright/test";

const port = Number(process.env.VISUAL_WEB_PORT ?? 3000);

export default defineConfig({
  testDir: "./apps/web/__visual__",
  outputDir: "./test-results/visual",
  snapshotDir: "./apps/web/__visual__/__baseline__",
  snapshotPathTemplate: "{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}",
  timeout: 45_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    command: `pnpm --filter @werewolf/web dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    env: {
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
      NEXT_PUBLIC_GAME_SERVER_URL: "ws://127.0.0.1:9",
      BETTER_AUTH_SECRET: "visual-secret-that-is-long-enough-32-chars",
      GAME_TOKEN_SECRET: "visual-token-secret-that-is-long-enough",
    },
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
    },
  },
});
