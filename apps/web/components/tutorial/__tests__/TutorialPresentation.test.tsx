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
    expect(tutorialCss).toContain("body:has(.tutorial-shell)::before");
    expect(tutorialCss).toContain(".tutorial-shell::before");
    expect(tutorialCss).toContain("content: none");
  });

  it("keeps only the first scene in the entry module and lazy-loads scenes two through six as one bundle", () => {
    expect(flipbookSource).toContain('import { SlideSetup } from "./SlideSetup"');
    expect(flipbookSource).toContain('import("./TutorialDeferredSlide")');
    expect(flipbookSource.match(/\bdynamic\(/g)).toHaveLength(1);
  });

  it("keeps the narrow day scene compact enough for the fixed mobile stage", () => {
    expect(tutorialCss).toContain('[data-tutorial-scene="day"] .tutorial-slide-title');
    expect(clueChipsSource).toContain("Разкрий 2-3 карти. Посетени:");
  });

  it("uses fully opaque light foreground text on dark tutorial controls", () => {
    expect(tutorialCss).toContain(".tutorial-keyboard-hint");
    expect(tutorialCss).toContain("color: #ead9ba");
    expect(tutorialCss).toContain(".tutorial-final-secondary-hint");
  });

  it("gives the keyboard hint a WCAG AA light-theme foreground", () => {
    const lightHintRule = tutorialCss.match(
      /html\[data-theme="light"\][^\n]*\.tutorial-keyboard-hint[^\{]*\{[^}]*color:\s*(#[0-9a-f]{6})/i,
    );

    expect(lightHintRule?.[1]).toBeDefined();
    expect(contrastRatio(lightHintRule?.[1] ?? "#ffffff", "#fcf6ec")).toBeGreaterThanOrEqual(4.5);
  });

  it("does not prefetch hidden destination trees before the reader chooses to leave", () => {
    expect(flipbookSource).toContain('prefetch={false}');
    expect(progressSource).toContain('prefetch={false}');
    expect(finalSlideSource.match(/prefetch=\{false\}/g)).toHaveLength(5);
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
