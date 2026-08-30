import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceHints } from "@/components/resource-hints";
import { getGameHomeHeroPreloads } from "../game-home-page";

describe("game home hero image loading", () => {
  it.each([
    ["werewolves", "werewolf", "v3"],
    ["mafia", "mafia", "v2"],
  ] as const)("preloads only the responsive %s theme candidate", (family, path, mobileDarkVersion) => {
    const html = renderToStaticMarkup(<ResourceHints images={getGameHomeHeroPreloads(family)} />);
    const links = Array.from(html.matchAll(/<link[^>]+>/g), (match) => match[0]);
    const expected = [
      [`/game-art/${path}/bg-hero-v2.avif`, "(min-width: 721px) and (prefers-color-scheme: dark)"],
      [`/game-art/${path}/bg-hero-light-v1.avif`, "(min-width: 721px) and (prefers-color-scheme: light)"],
      [`/game-art/mobile/${path}/bg-hero-${mobileDarkVersion}.avif`, "(max-width: 720px) and (prefers-color-scheme: dark)"],
      [`/game-art/mobile/${path}/bg-hero-light-v1.avif`, "(max-width: 720px) and (prefers-color-scheme: light)"],
    ];

    expect(links).toHaveLength(4);
    for (const [index, [href, media]] of expected.entries()) {
      expect(links[index]).toContain(`href="${href}"`);
      expect(links[index]).toContain(`media="${media}"`);
      expect(links[index]).toContain('type="image/avif"');
      expect(links[index]).toContain('fetchPriority="high"');
    }
  });
});
