import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("validated route design-system repairs", () => {
  it.each([
    ["components/status/StatusHero.tsx", "SceneCard"],
    ["app/history/[gameId]/replay/page.tsx", "SceneCard"],
  ])("routes %s hero art through %s instead of page-local Image fill", (path, primitive) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");

    expect(source).toContain(primitive);
    expect(source).not.toContain('from "next/image"');
    expect(source).not.toMatch(/<Image[\s\S]*?\bfill\b/);
  });

  it.each([
    ["app/achievements/page.tsx", "PaperCard"],
    ["app/not-found.tsx", "PaperCard"],
  ])("removes the validated raw radius from %s through %s", (path, primitive) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");

    expect(source).toContain(primitive);
    expect(source).not.toContain("rounded-[2rem]");
  });
});
