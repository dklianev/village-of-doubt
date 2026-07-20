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
