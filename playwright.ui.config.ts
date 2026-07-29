import { defineConfig } from "playwright/test";

const port = Number(process.env.VISUAL_UI_PORT ?? 6006);

export default defineConfig({
  testDir: "./packages/ui/__visual__",
  outputDir: "./test-results/ui-visual",
  snapshotDir: "./packages/ui/__visual__/__baseline__",
  snapshotPathTemplate: "{snapshotDir}/{testFilePath}-snapshots/{arg}{ext}",
  timeout: 45_000,
  retries: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: `pnpm --filter @werewolf/ui exec storybook dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
});
