import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "components/offline/Offline.module.css"), "utf8");
const style = document.createElement("style");
style.textContent = css;
document.head.append(style);
const rules = Array.from(style.sheet!.cssRules);
style.remove();

function declaration(selector: string, property: string): string {
  const rule = rules.find((item) => "selectorText" in item && item.selectorText === selector) as CSSStyleRule | undefined;
  expect(rule, selector).toBeDefined();
  return rule!.style.getPropertyValue(property).trim();
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    const channels = [1, 3, 5].map((offset) => {
      const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("offline visual contract", () => {
  it("separates light artwork copy from dark supporting text on the light surface", () => {
    const lightShell = ':global(html[data-theme="light"] .offline-shell)';
    const artworkText = declaration(lightShell, "--offline-art-text")
      || declaration(":global(.offline-shell)", "--offline-art-text");
    const surfaceText = declaration(lightShell, "--offline-text-muted");

    expect(declaration(":global(.offline-hero-copy h1)", "color")).toBe("var(--offline-art-text)");
    expect(declaration(":global(.offline-hero-copy p:not(.offline-kicker))", "color")).toBe("var(--offline-art-text)");
    expect(declaration(":global(.offline-actions p)", "color")).toBe("var(--offline-text-muted)");
    expect(artworkText).not.toBe(surfaceText);

    // Token-level contrast on representative surfaces; image composites need browser checks.
    expect(contrastRatio(artworkText, "#171a1c")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(surfaceText, "#fcf6ec")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the retry control at a full touch target", () => {
    expect(declaration(":global(.offline-status-retry)", "width")).toBe("44px");
    expect(declaration(":global(.offline-status-retry)", "height")).toBe("44px");
  });
});
