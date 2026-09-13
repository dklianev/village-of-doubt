import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameHero } from "../game-home-page";
import { RoleSpotlight } from "../RoleSpotlight";
import { WerewolfNightTimeline } from "../WerewolfNightTimeline";
import { MafiaNightTimeline } from "../MafiaNightTimeline";

describe("game home image loading", () => {
  it.each(["werewolves", "mafia"] as const)("lets the selected %s theme choose the hero, without OS-theme preloads", (family) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<GameHero family={family} />);
    expect(container.querySelector(".game-home-hero__art")).not.toBeNull();
    expect(container.querySelector('link[rel="preload"][as="image"]')).toBeNull();
  });

  it.each(["werewolves", "mafia"] as const)("defers responsive %s illustrations and full-size portraits", (family) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(
      <>
        {family === "mafia" ? <MafiaNightTimeline /> : <WerewolfNightTimeline />}
        <RoleSpotlight family={family} />
      </>,
    );
    const images = Array.from(container.querySelectorAll("img"));
    expect(images).toHaveLength(7);
    for (const image of images) {
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.sizes).not.toBe("");
      expect(image.srcset).not.toBe("");
      expect(decodeURIComponent(image.src)).not.toContain("/thumbs/");
    }
    expect(container.querySelector('link[rel="preload"][as="image"]')).toBeNull();
  });
});
