import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tutorialCss = readFileSync(resolve(process.cwd(), "components/tutorial/Tutorial.module.css"), "utf8");
const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const clueChipsSource = readFileSync(resolve(process.cwd(), "components/tutorial/DayClueChips.tsx"), "utf8");
const flipbookSource = readFileSync(resolve(process.cwd(), "components/tutorial/TutorialFlipbook.tsx"), "utf8");
const progressSource = readFileSync(resolve(process.cwd(), "components/tutorial/TutorialProgress.tsx"), "utf8");
const finalSlideSource = readFileSync(resolve(process.cwd(), "components/tutorial/SlideFinal.tsx"), "utf8");
const setupSlideSource = readFileSync(resolve(process.cwd(), "components/tutorial/SlideSetup.tsx"), "utf8");

describe("tutorial presentation contract", () => {
  it("resolves the cinematic hero through theme-specific tutorial art tokens", () => {
    expect(globalsCss).not.toContain("--art-tutorial-day");
    expect(globalsCss).not.toContain("--art-tutorial-night");
    expect(globalsCss).not.toContain("--art-tutorial-dark");
    expect(globalsCss).not.toContain("--art-tutorial-light");
    expect(tutorialCss).toContain("--art-tutorial-dark: image-set(");
    expect(tutorialCss).toContain("--art-tutorial-light: image-set(");
    expect(tutorialCss).toContain("--art-tutorial: var(--art-tutorial-dark)");
    expect(tutorialCss).toContain("--art-tutorial: var(--art-tutorial-light)");
    expect(tutorialCss).toContain('body:has(.site-chrome[data-route="/tutorial"])::before');
    expect(tutorialCss).not.toContain("body:has(.tutorial-shell)");
    expect(tutorialCss).toContain(".tutorial-shell::before");
    expect(tutorialCss).toContain("content: none");
  });

  it("receives the static first scene from the server and lazy-loads interactive scenes", () => {
    expect(flipbookSource).not.toContain('from "./SlideSetup"');
    const page = readFileSync(resolve(process.cwd(), "app/tutorial/page.tsx"), "utf8");
    for (const mode of ["werewolves_classic", "mafia_free", "mafia_sport"]) {
      expect(page).toContain(`<SlideSetup mode="${mode}" />`);
    }
    expect(flipbookSource).toContain("setupScene={setupScenes[mode]}");
    const loader = readFileSync(resolve(process.cwd(), "components/tutorial/tutorial-deferred.ts"), "utf8");
    expect(loader).toContain('import("./TutorialDeferredSlide")');
    expect(flipbookSource).not.toContain('from "./TutorialDeferredSlide"');
    expect(flipbookSource).not.toContain('from "next/dynamic"');
  });

  it("lets scenes grow with their content instead of cropping text inside a fixed-height stage", () => {
    const stageRule = tutorialCss.match(/:global\(\.tutorial-slide-stage\)\s*\{([^}]+)\}/)?.[1];
    expect(stageRule).toBeDefined();
    expect(stageRule).not.toMatch(/(?:^|;)\s*height:/);
    expect(tutorialCss).not.toContain("height: 680px");
    expect(tutorialCss).not.toContain("overflow: hidden");
    expect(tutorialCss).toContain("background-size: cover");
    expect(tutorialCss).not.toContain("50% 100%");
    expect(clueChipsSource).toContain("Примерни реплики");
  });

  it("uses theme-specific opaque ink with sufficient contrast on the reading surface", () => {
    let themesChecked = 0;
    for (const rule of tutorialCss.matchAll(/body:has\(\.site-chrome\[data-route="\/tutorial"\]\)\)?\s*\{([^}]+)\}/g)) {
      const color = (token: string) => rule[1]!.match(new RegExp(`--tutorial-${token}:\\s*(#[0-9a-f]{6})`))?.[1];
      const paper = color("paper");
      if (!paper) continue;
      themesChecked++;
      for (const token of ["ink", "soft", "accent", "metal"]) {
        expect(contrastRatio(color(token)!, paper)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(themesChecked).toBe(2);
  });

  it("does not prefetch hidden destination trees before the reader chooses to leave", () => {
    let linksChecked = 0;
    for (const source of [flipbookSource, progressSource, finalSlideSource]) {
      for (const [link] of source.matchAll(/<Link\b[^>]+>/g)) {
        linksChecked++;
        expect(link).toContain("prefetch={false}");
      }
    }
    expect(linksChecked).toBeGreaterThan(0);
  });

  it("matches the current signed-in room flow", () => {
    expect(setupSlideSource).not.toContain("Никой не се регистрира");
    expect(setupSlideSource).toContain("Картите се раздават, когато домакинът започне играта");
  });
});

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/.{2}/g)!
      .map((value) => Number.parseInt(value, 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
