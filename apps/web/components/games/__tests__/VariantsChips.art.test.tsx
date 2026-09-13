import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VariantsChips } from "../VariantsChips";

describe("illustrated family variants", () => {
  it.each(["werewolves", "mafia"] as const)("uses real, responsive artwork for each %s story", (family) => {
    const html = document.createElement("div");
    html.innerHTML = renderToStaticMarkup(<VariantsChips family={family} />);
    const stories = html.querySelectorAll(".variant-chip");
    expect(stories).toHaveLength(3);
    for (const story of stories) {
      const image = story.querySelector("img");
      expect(image).not.toBeNull();
      expect(image?.getAttribute("loading")).toBe("lazy");
      expect(image?.getAttribute("sizes")).toBeTruthy();
      expect(decodeURIComponent(image?.src ?? "")).not.toContain("/thumbs/");
      expect(story.querySelector("h3")).not.toBeNull();
    }
  });
});
