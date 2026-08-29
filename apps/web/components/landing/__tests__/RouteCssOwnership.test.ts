import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("route CSS ownership", () => {
  it("keeps the decorative logo outside the LCP priority lane", () => {
    const landing = read("components/landing-experience.tsx");

    expect(landing).toMatch(/logo-landing-mark\.webp[\s\S]*fetchPriority="low"/);
  });

  it("keeps landing mobile rules in the landing surface only", () => {
    const globals = read("app/globals.css");
    const landing = read("components/landing/LandingSurface.module.css");

    for (const selector of [
      ".landing-hero-card",
      ".game-choice-grid",
      ".landing-split-grid .game-choice-card",
      ".landing-split-grid .game-choice-card h2",
    ]) {
      expect(landing).toContain(selector);
      expect(globals).not.toContain(selector);
    }
  });

  it("does not ship selectors from the retired multi-step create layout", () => {
    const create = read("components/lobby/LegacyCreate.module.css");

    expect(create).not.toContain(".lobby-wizard-main");
    expect(create).not.toContain(".lobby-step-pane");
    expect(create).not.toContain(".lobby-step-slot");
  });

  it("does not keep globally orphaned cards and play labels", () => {
    const globals = read("app/globals.css");

    expect(globals).not.toContain(".empty-state-card");
    expect(globals).not.toContain(".play-main-stack");
    expect(globals).not.toContain(".play-phase-pill");
    expect(globals).not.toContain(".play-phase-dot");
  });
});
