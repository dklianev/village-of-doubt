import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tutorialCss = readFileSync(resolve(process.cwd(), "components/tutorial/Tutorial.module.css"), "utf8");
const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const clueChipsSource = readFileSync(resolve(process.cwd(), "components/tutorial/DayClueChips.tsx"), "utf8");

describe("tutorial presentation contract", () => {
  it("resolves the cinematic hero through theme-specific tutorial art tokens", () => {
    expect(globalsCss).toContain("--art-tutorial-dark: image-set(");
    expect(globalsCss).toContain("--art-tutorial-light: image-set(");
    expect(globalsCss).toContain("--art-tutorial: var(--art-tutorial-dark)");
    expect(globalsCss).toContain("--art-tutorial: var(--art-tutorial-light)");
    expect(globalsCss).toContain("body:has(.tutorial-shell)::before");
    expect(tutorialCss).toContain(".tutorial-shell::before");
    expect(tutorialCss).toContain("content: none");
  });

  it("keeps the narrow day scene compact enough for the fixed mobile stage", () => {
    expect(tutorialCss).toContain('[data-tutorial-scene="day"] .tutorial-slide-title');
    expect(clueChipsSource).toContain("Разкрий 2-3 карти. Посетени:");
  });
});
