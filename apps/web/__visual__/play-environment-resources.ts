import type { Locator, Page } from "playwright/test";

interface EnvironmentResourceState {
  sources: Record<string, string>;
  observedEntries: number;
  bufferFullEvents: number;
  supported: boolean;
}

declare global {
  interface Window {
    __playEnvironmentResources?: EnvironmentResourceState;
  }
}

export async function observePlayEnvironmentResources(page: Page) {
  await page.addInitScript(() => {
    const state: EnvironmentResourceState = {
      sources: {}, observedEntries: 0, bufferFullEvents: 0,
      supported: typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("resource"),
    };
    window.__playEnvironmentResources = state;
    performance.addEventListener("resourcetimingbufferfull", () => { state.bufferFullEvents++; });
    if (!state.supported) return;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.observedEntries++;
        const url = new URL(entry.name);
        // At most 16 paths: two families, scenes, viewport variants and formats.
        // Keep the latest full URL per path so query revisions cannot grow storage.
        if (url.origin === location.origin && /^\/game-art\/(mobile\/)?play\/bg-play-(werewolves|mafia)-(day|night)-v2\.(avif|webp)$/.test(url.pathname)) {
          state.sources[url.pathname] = entry.name;
        }
      }
    }).observe({ type: "resource", buffered: true });
  });
}

export async function loadedEnvironment(target: Locator, pseudo: string | null) {
  return target.evaluate(async (element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    const candidates = Array.from(style.backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
    const requested = new Set(Object.values(window.__playEnvironmentResources?.sources ?? {}));
    const selected = candidates.find((url) => requested.has(url));
    const image = new Image();
    if (selected) {
      image.src = selected;
      try {
        await image.decode();
      } catch {
        throw new Error(`Cannot decode selected environment: ${selected}`);
      }
    }
    return {
      path: selected ? new URL(selected).pathname : null,
      candidates: candidates.map((url) => new URL(url).pathname),
      width: parseFloat(style.width),
      height: parseFloat(style.height),
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      position: style.position,
      filter: style.filter,
      backgroundPosition: style.backgroundPosition,
    };
  }, pseudo);
}

export async function playEnvironmentDiagnostics(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector("main.play-shell");
    const stage = document.querySelector(".play-stage");
    return {
      resources: window.__playEnvironmentResources,
      bufferedEntries: performance.getEntriesByType("resource").length,
      readyState: document.readyState,
      phase: shell?.getAttribute("data-phase"),
      outerBackground: shell ? getComputedStyle(shell, "::before").backgroundImage : null,
      stageBackground: stage ? getComputedStyle(stage).backgroundImage : null,
    };
  });
}
