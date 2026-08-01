import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("leaderboard database cache", () => {
  it("keeps the public aggregate behind a short server-side TTL", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leaderboard/page.tsx"), "utf8");

    expect(source).toContain('import { unstable_cache } from "next/cache"');
    expect(source).toContain("loadCachedLeaderboard");
    expect(source).toMatch(/revalidate:\s*60/);
  });
});
