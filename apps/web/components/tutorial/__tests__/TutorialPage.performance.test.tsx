import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TutorialPage from "@/app/tutorial/page";

const route = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(route.query) }));

function pageMarkup(query: string) {
  route.query = query;
  return new DOMParser().parseFromString(renderToStaticMarkup(<TutorialPage />), "text/html");
}

describe("tutorial critical artwork", () => {
  for (const game of ["werewolves_classic", "mafia_free", "mafia_sport"]) {
    it.each([[1, "day"], [2, "night"], [3, "day"], [4, "day"], [5, "night"], [6, "night"]])(
      `${game} preloads only the matching art for scene %i`, (step, lighting) => {
        const html = pageMarkup(`game=${game}&step=${step}`);
        const images = [...html.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')];
        expect(images.map((image) => [image.getAttribute("href"), image.media, image.getAttribute("fetchpriority")])).toEqual(
          game === "werewolves_classic" ? [
            [`/game-art/tutorial-${lighting}-scene.webp`, "(min-width: 721px), (orientation: portrait)", "high"],
            [`/game-art/mobile/tutorial-${lighting}-scene.webp`, "(max-width: 720px) and (orientation: landscape)", "high"],
          ] : [[`/game-art/phase-board/v1/mafia/icon-phase-${lighting}-1120.webp`, "", "high"]],
        );
      },
    );
  }

  it("keeps the art media queries aligned with compact landscape CSS", () => {
    const html = pageMarkup("game=werewolves_classic&step=1");
    const compact = html.querySelector('link[href="/game-art/mobile/tutorial-day-scene.webp"]');
    const css = readFileSync(resolve(process.cwd(), "components/tutorial/Tutorial.module.css"), "utf8");
    expect(css).toContain(`@media ${compact!.getAttribute("media")}`);
  });

  it("renders state-changing controls disabled before hydration without blocking the invitation link", () => {
    const html = pageMarkup("step=1&redirect=%2Fmafia%2Fjoin%2FABC123");
    expect(html.querySelector<HTMLSelectElement>("#tutorial-game")!.disabled).toBe(true);
    expect(html.querySelector("#tutorial-game")!.getAttribute("autocomplete")).toBe("off");
    const buttons = [...html.querySelectorAll<HTMLButtonElement>(".tutorial-progress button, .tutorial-nav button")];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons.every((button) => button.getAttribute("autocomplete") === "off")).toBe(true);
    expect(html.querySelector(".tutorial-skip-link")!.getAttribute("href")).toBe("/mafia/join/ABC123");
  });
});
