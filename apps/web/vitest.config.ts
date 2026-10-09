import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Real-browser suites bundle fixtures and launch Chromium/Firefox/WebKit in hooks; under a
    // full parallel run the 10 s/5 s defaults time out although every file passes in isolation.
    hookTimeout: 60_000,
    testTimeout: 20_000,
    globals: false,
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "hooks/**/*.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
    ],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
