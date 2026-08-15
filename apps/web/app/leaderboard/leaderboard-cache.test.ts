import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("leaderboard database cache", () => {
  it("uses the Cache Components contract for the public aggregate", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "app/leaderboard/page.tsx"), "utf8");
    const configSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(configSource).toContain("cacheComponents: true");
    expect(pageSource).toContain('"use cache"');
    expect(pageSource).toContain('cacheTag("public-leaderboard")');
    expect(pageSource).toMatch(/cacheLife\(\{[\s\S]*revalidate:\s*60/);
    expect(pageSource).not.toContain("unstable_cache");
  });

  it("enables detailed router transition events for observability", () => {
    const configSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(configSource).toContain("instrumentationClientRouterTransitionEvents: true");
  });
});
