import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("roles catalog backdrop", () => {
  it("uses the night art token so phones get the light mobile file for each family", () => {
    const css = readFileSync(resolve(process.cwd(), "components/games/GameRolesPage.module.css"), "utf8");
    const globals = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const backdrops = [...css.matchAll(/\.roles-shell(?:\[[^\]]*\])?::before\) \{([^}]*)\}/g)].map(([, body]) => body);

    expect(backdrops).toHaveLength(2);
    for (const body of backdrops) {
      expect(body).toContain("var(--art-night)");
      expect(body).not.toMatch(/bg-night-phase/);
    }
    expect(globals).toContain('--art-night: image-set(url("/game-art/mobile/bg-night-phase.webp")');
    expect(globals).toContain('--art-night: image-set(url("/game-art/mobile/mafia/bg-night-phase.webp")');
  });
});
