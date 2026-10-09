import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FamilyHeroPreload } from "../FamilyHeroPreload";
import { ThemedHeroPreload } from "@/components/themed-hero-preload";

afterEach(() => {
  document.head.querySelectorAll('link[rel="preload"][as="image"]').forEach((link) => link.remove());
  delete document.documentElement.dataset.theme;
});

describe("family hero preload", () => {
  for (const theme of ["light", "dark"] as const) {
    it.each([320, 390, 800, 801, 1440])(`sign-in ${theme} %i follows its own breakpoint`, (width) => {
      document.documentElement.dataset.theme = theme;
      const html = renderToStaticMarkup(<ThemedHeroPreload scene="sign-in" />);
      const script = new DOMParser().parseFromString(html, "text/html").querySelector("script")!.textContent!;
      const matchMedia = vi.fn(() => ({ matches: width <= 800 }));
      const run = new Function("document", "matchMedia", script);
      run(document, matchMedia);
      run(document, matchMedia);
      const images = document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]');
      expect(images).toHaveLength(1);
      expect(images[0]!.getAttribute("href")).toBe(`/game-art/${width <= 800 ? "mobile/" : ""}auth/bg-sign-in-${theme}-v2.avif`);
      expect(images[0]!.fetchPriority).toBe("high");
      expect(matchMedia).toHaveBeenCalledWith("(max-width: 800px)");
    });
  }
  for (const family of ["werewolves", "mafia"] as const) {
    for (const theme of ["light", "dark"] as const) {
      it.each([
        { width: 320, dpr: 1, directory: "mobile/", suffix: "-864" },
        { width: 390, dpr: 1.75, directory: "mobile/", suffix: "-864" },
        { width: 480, dpr: 1.75, directory: "mobile/", suffix: "-864" },
        { width: 390, dpr: 2, directory: "mobile/", suffix: "" },
        { width: 480, dpr: 3, directory: "mobile/", suffix: "" },
        { width: 481, dpr: 1, directory: "mobile/", suffix: "" },
        { width: 720, dpr: 1, directory: "mobile/", suffix: "" },
        { width: 721, dpr: 2, directory: "", suffix: "" },
        { width: 1440, dpr: 1, directory: "", suffix: "" },
      ])(`${family} ${theme} $width / $dpr resolves one exact candidate`, ({ width, dpr, directory, suffix }) => {
        document.documentElement.dataset.theme = theme;
        const script = new DOMParser().parseFromString(renderToStaticMarkup(<FamilyHeroPreload family={family} />), "text/html").querySelector("script")!.textContent!;
        const matchMedia = vi.fn((query: string) => ({ matches: query.includes("resolution") ? width <= 480 && dpr <= 1.75 : width <= 720 }));
        const run = new Function("document", "matchMedia", script);
        run(document, matchMedia);
        run(document, matchMedia);
        const links = [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="image"]')];
        expect(links).toHaveLength(1);
        const version = theme === "light" ? "light-v1" : directory ? "v3" : "v2";
        expect(links[0]!.getAttribute("href")).toBe(`/game-art/${directory}${family === "mafia" ? "mafia" : "werewolf"}/bg-hero-${version}${suffix}.avif`);
        expect(links[0]!.type).toBe("image/avif");
        expect(links[0]!.fetchPriority).toBe("high");
        expect(matchMedia.mock.calls.every(([query]) => !query.includes("prefers-color-scheme"))).toBe(true);
      });
    }
  }
});
