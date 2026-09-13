import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TutorialPage from "@/app/tutorial/page";

vi.mock("@/components/tutorial/TutorialFlipbook", () => ({ TutorialFlipbook: () => null }));

describe("tutorial critical artwork", () => {
  it("preloads the detailed portrait scene and reserves the small scene for compact landscape", () => {
    const html = new DOMParser().parseFromString(renderToStaticMarkup(<TutorialPage />), "text/html");
    const images = [...html.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')];
    expect(images.map((image) => [image.getAttribute("href"), image.media, image.getAttribute("fetchpriority")])).toEqual([
      ["/game-art/tutorial-day-scene.webp", "(min-width: 721px), (orientation: portrait)", "high"],
      ["/game-art/mobile/tutorial-day-scene.webp", "(max-width: 720px) and (orientation: landscape)", "high"],
    ]);
    const css = readFileSync(resolve(process.cwd(), "components/tutorial/Tutorial.module.css"), "utf8");
    expect(css).toContain("@media (max-width: 720px) and (orientation: landscape)");
  });
});
