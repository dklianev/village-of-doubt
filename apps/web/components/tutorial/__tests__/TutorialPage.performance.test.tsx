import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TutorialPage from "@/app/tutorial/page";

const route = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(route.query) }));

async function pageMarkup(query: string) {
  route.query = query;
  const stream = await renderToReadableStream(<TutorialPage
    searchParams={Promise.resolve(Object.fromEntries(new URLSearchParams(query)))} />);
  await stream.allReady;
  return new DOMParser().parseFromString(await new Response(stream).text(), "text/html");
}

describe("tutorial critical artwork", () => {
  for (const game of ["werewolves_classic", "mafia_free", "mafia_sport"]) {
    it.each([[1, "day"], [2, "night"], [3, "day"], [4, "day"], [5, "night"], [6, "night"]])(
      `${game} preloads only the matching art for scene %i`, async (step, lighting) => {
        const html = await pageMarkup(`game=${game}&step=${step}`);
        const images = [...html.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')];
        expect(images.map((image) => [image.getAttribute("href"), image.media, image.getAttribute("fetchpriority")])).toEqual(
          game === "werewolves_classic" ? [
            [`/game-art/tutorial-${lighting}-scene.avif`, "(min-width: 481px), (resolution > 2dppx)", "high"],
            [`/game-art/mobile/tutorial-${lighting}-scene-960.avif`, "(max-width: 480px) and (max-resolution: 2dppx)", "high"],
          ] : [[`/game-art/phase-board/v1/mafia/icon-phase-${lighting}-1120.webp`, "", "high"]],
        );
      },
    );
  }

  it("keeps the art media queries aligned with compact density-aware CSS", async () => {
    const html = await pageMarkup("game=werewolves_classic&step=1");
    const compact = html.querySelector('link[href="/game-art/mobile/tutorial-day-scene-960.avif"]');
    const css = readFileSync(resolve(process.cwd(), "components/tutorial/Tutorial.module.css"), "utf8");
    expect(css).toContain(`@media ${compact!.getAttribute("media")}`);
  });

  it("renders state-changing controls disabled before hydration without blocking the invitation link", async () => {
    const html = await pageMarkup("step=1&redirect=%2Fmafia%2Fjoin%2FABC123");
    expect(html.querySelector<HTMLSelectElement>("#tutorial-game")!.disabled).toBe(true);
    expect(html.querySelector("#tutorial-game")!.getAttribute("autocomplete")).toBe("off");
    const buttons = [...html.querySelectorAll<HTMLButtonElement>(".tutorial-progress button, .tutorial-nav button")];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(buttons.every((button) => button.getAttribute("autocomplete") === "off")).toBe(true);
    expect(html.querySelector(".tutorial-skip-link")!.getAttribute("href")).toBe("/mafia/join/ABC123");
  });

  it.each(["werewolves_classic", "mafia_free", "mafia_sport"])("sizes the %s example portrait for its rendered place", async (game) => {
    const html = await pageMarkup(`game=${game}&step=1`);
    const image = html.querySelector<HTMLImageElement>(".tutorial-role > img")!;
    expect(image.getAttribute("sizes")).toBe("(max-width: 640px) 84px, 112px");
    expect(image.getAttribute("srcset")).toContain("256w");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("fetchpriority")).toBe("low");
  });
});
