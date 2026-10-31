import { defineConfig } from "playwright/test";
import appConfig from "./playwright.config";

export default defineConfig({
  testDir: "./scripts/browser-contracts",
  outputDir: "./test-results/browser-contracts",
  timeout: 240_000,
  retries: 0,
  workers: 1,
  use: appConfig.use,
  webServer: appConfig.webServer,
});
