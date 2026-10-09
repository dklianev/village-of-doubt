import { renderToStaticMarkup } from "react-dom/server";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameHero } from "../game-home-page";
import { RoleSpotlight } from "../RoleSpotlight";
import { WerewolfNightTimeline } from "../WerewolfNightTimeline";
import { MafiaNightTimeline } from "../MafiaNightTimeline";
import { VariantsChips } from "../VariantsChips";

afterEach(() => vi.unstubAllGlobals());

function withImageConfig(children: ReactNode) {
  return <ImageConfigContext.Provider value={{ ...imageConfigDefault, qualities: [75, 85] }}>{children}</ImageConfigContext.Provider>;
}

describe("game home image loading", () => {
  it.each(["werewolves", "mafia"] as const)("lets the selected %s theme choose the hero, without OS-theme preloads", (family) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<GameHero family={family} />);
    expect(container.querySelector(".game-home-hero__art")).not.toBeNull();
    expect(container.querySelector('link[rel="preload"][as="image"]')).toBeNull();
  });

  it.each(["werewolves", "mafia"] as const)("defers responsive %s illustrations and full-size portraits", (family) => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(withImageConfig(
      <>
        {family === "mafia" ? <MafiaNightTimeline /> : <WerewolfNightTimeline />}
        <RoleSpotlight family={family} />
        <VariantsChips family={family} />
      </>,
    ));
    const fallbacks = [...container.querySelectorAll("noscript")].map((noscript) => {
      const fallback = document.createElement("div");
      fallback.innerHTML = noscript.textContent!;
      return fallback;
    });
    const portraits = fallbacks.flatMap((fallback) => [...fallback.querySelectorAll("img")]);
    expect(container.querySelectorAll(".role-spotlight__art img, .variant-chip__art img, .role-art-frame")).toHaveLength(0);
    expect(fallbacks).toHaveLength(7);
    const frames = fallbacks.flatMap((fallback) => [...fallback.querySelectorAll<HTMLElement>(".role-art-frame")]);
    expect(frames).toHaveLength(6);
    for (const frame of frames) {
      expect(frame.dataset.frameFamily).toBe(family);
      expect(frame.style.position).toBe("absolute");
      expect(frame.style.inset).toBe("0px");
      expect(frame.querySelector("img")).not.toBeNull();
      expect(frame.querySelector("button, a, .role-spotlight__open")).toBeNull();
    }
    const images = [...container.querySelectorAll("img"), ...portraits];
    expect(images).toHaveLength(10);
    for (const image of images) {
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.sizes).not.toBe("");
      expect(image.srcset).not.toBe("");
      expect(decodeURIComponent(image.src)).not.toContain("/thumbs/");
    }
    expect(container.querySelector('link[rel="preload"][as="image"]')).toBeNull();
    expect(portraits).toHaveLength(7);
    expect(portraits.slice(0, 4).every((image) => image.getAttribute("fetchpriority") === "low")).toBe(true);
    expect(container.querySelectorAll(".role-spotlight__open")).toHaveLength(4);
    expect(container.querySelectorAll(".variant-chip__copy")).toHaveLength(3);
  });

  it.each(["werewolves", "mafia"] as const)("keeps distant %s portraits and frame CSS consumers absent until intersection", (family) => {
    const observers: { notify: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal("IntersectionObserver", vi.fn(function (notify: IntersectionObserverCallback) {
      const observer = { notify, observe: vi.fn(), disconnect: vi.fn() };
      observers.push(observer);
      return observer;
    }));
    const { container } = render(withImageConfig(<><RoleSpotlight family={family} /><VariantsChips family={family} /></>));
    const boxes = [...container.querySelectorAll(".role-spotlight__art, .variant-chip__art")];
    expect(boxes).toHaveLength(7);
    expect(observers).toHaveLength(7);
    observers.forEach((observer, index) => expect(observer.observe).toHaveBeenCalledWith(boxes[index]));
    expect(container.querySelectorAll("img, .role-art-frame")).toHaveLength(0);
    act(() => observers.forEach(({ notify }) => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)));
    expect(container.querySelectorAll("img, .role-art-frame")).toHaveLength(0);
    expect(container.querySelectorAll("button[data-role]")).toHaveLength(6);
    act(() => observers.forEach(({ notify }) => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)));
    expect(container.querySelectorAll("img")).toHaveLength(7);
    expect(container.querySelectorAll(".role-art-frame")).toHaveLength(6);
    expect([...container.querySelectorAll(".role-spotlight__art, .variant-chip__art")]).toEqual(boxes);
    for (const box of boxes) expect(box).not.toHaveClass("role-art-frame");
    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledOnce();
  });
});
