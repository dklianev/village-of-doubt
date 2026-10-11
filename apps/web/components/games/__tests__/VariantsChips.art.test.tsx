import { renderToStaticMarkup } from "react-dom/server";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { describe, expect, it } from "vitest";
import { roleArtPath } from "@/lib/role-art";
import { VariantsChips } from "../VariantsChips";

describe("illustrated family variants", () => {
  it.each(["werewolves", "mafia"] as const)("defers real, responsive artwork with a no-JS fallback for each %s story", (family) => {
    const html = document.createElement("div");
    html.innerHTML = renderToStaticMarkup(
      <ImageConfigContext.Provider value={{ ...imageConfigDefault, qualities: [75, 85] }}>
        <VariantsChips family={family} />
      </ImageConfigContext.Provider>,
    );
    const sources = family === "mafia"
      ? ["/game-art/mafia/night-5-morning.webp", roleArtPath(family, "doctor"), roleArtPath(family, "lawyer")]
      : ["/game-art/werewolf/night-5-dawn.webp", roleArtPath(family, "cupid"), roleArtPath(family, "vampire")];
    const stories = html.querySelectorAll(".variant-chip");
    expect(stories).toHaveLength(3);
    for (const [index, story] of stories.entries()) {
      expect(story.querySelector("img, .role-art-frame")).toBeNull();
      expect(story.querySelectorAll("noscript")).toHaveLength(1);
      const fallback = document.createElement("div");
      fallback.innerHTML = story.querySelector("noscript")!.textContent!;
      expect(fallback.querySelectorAll("img")).toHaveLength(1);
      const image = fallback.querySelector("img")!;
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.sizes).not.toBe("");
      expect(image.srcset).not.toBe("");
      expect(new URL(image.src).searchParams.get("url")).toBe(sources[index]);
      expect(decodeURIComponent(image.src)).not.toContain("/thumbs/");
      expect(story.querySelector("h3")).not.toBeNull();
    }
    expect(html.querySelector('link[rel="preload"][as="image"]')).toBeNull();
  });
});
