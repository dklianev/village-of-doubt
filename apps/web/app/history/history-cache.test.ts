import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public history cache", () => {
  it("uses a tagged short-lived Cache Components entry", () => {
    const source = readFileSync(resolve(process.cwd(), "app/history/page.tsx"), "utf8");

    expect(source).toContain('"use cache"');
    expect(source).toContain('cacheTag("public-game-history")');
    expect(source).toMatch(/cacheLife\(\{[\s\S]*revalidate:\s*60/);
    expect(source).not.toContain("unstable_cache");
  });
});
