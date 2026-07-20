import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Gameplay tests must never inherit a developer or production database.
    // Persistence integration tests inject their own explicit test doubles/URLs.
    env: {
      DATABASE_URL: "",
    },
  },
});
