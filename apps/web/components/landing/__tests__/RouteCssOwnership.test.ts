import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("route CSS ownership", () => {
  it("gates page-wide styles on the active route rather than cached page shells", () => {
    for (const file of [
      "app/globals.css",
      "components/games/GameRolesPage.module.css",
      "components/landing/LandingSurface.module.css",
      "components/lobby/LegacyCreate.module.css",
      "components/legal/LegalShell.module.css",
      "components/faq/LegacyFaq.module.css",
      "components/tutorial/Tutorial.module.css",
    ]) {
      const css = read(file);
      expect(css, file).not.toMatch(/body:has\(\.(?:landing-shell|game-home-shell|tutorial-shell|account-shell|achievement-shell|friends-shell|roles-shell|legal-page-shell|faq-hearth|lobby-wizard)\b/);
    }
  });

  it("stops ambient profile and achievement motion without hiding the artwork", () => {
    const globals = read("app/globals.css");
    const media = globals.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([^]*?)\n\}/)?.[1] ?? "";
    expect(media).toContain('[data-route="/account"]');
    expect(media).toContain('[data-route="/achievements"]');
    expect(media).toContain("animation: none;");
    expect(media).toContain("will-change: auto;");
    expect(media).not.toContain("display: none");
  });

  it("uses one composited decorative hero without downloading a second logo layer", () => {
    const landing = read("components/landing-experience.tsx");

    expect(landing.match(/className="landing-hero-art"/g)).toHaveLength(1);
    expect(landing).toContain('className="landing-hero-art" aria-hidden="true"');
    expect(landing).not.toContain("logo-landing-mark.webp");
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

  it("keeps landing-only art tokens and hero declarations out of shared CSS", () => {
    const globals = read("app/globals.css");
    const landing = read("components/landing/LandingSurface.module.css");

    expect(globals).not.toContain("--art-landing-dual");
    expect(globals).not.toContain("--art-landing-hero-composited");
    expect(landing).toContain("--art-landing-dual: image-set(");
    const hero = landing.match(/:global\(\.landing-hero-card\)\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(hero).toContain("padding: 20px 24px 24px;");
    expect(hero).not.toContain("min-height:");
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
