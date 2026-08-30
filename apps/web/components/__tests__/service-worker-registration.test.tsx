import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const registrationSource = readFileSync(resolve(process.cwd(), "components/service-worker-registration.tsx"), "utf8");
const workerSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const nextConfigSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

describe("ServiceWorkerRegistration", () => {
  it("bypasses the HTTP cache when checking the stable worker script URL", async () => {
    expect(registrationSource).toContain('register("/sw.js", { updateViaCache: "none" })');
  });

  it("bounds and refreshes the artwork cache from the network", () => {
    expect(workerSource).toContain("const MAX_ART_ENTRIES = 64");
    expect(workerSource).toContain("const networkPromise = fetch(event.request)");
    expect(workerSource).toContain("event.waitUntil(");
    expect(workerSource).toContain("trimArtCache(cache)");
    expect(nextConfigSource).toContain('value: "no-store, must-revalidate"');
  });

  it("returns fresh artwork before its cache write and trim finish", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    let releaseCacheWrite = () => {};
    const cacheWrite = new Promise<void>((resolveWrite) => {
      releaseCacheWrite = resolveWrite;
    });
    const networkResponse = { ok: true, clone: () => networkResponse };
    const cache = {
      put: () => cacheWrite,
      keys: async () => [],
      match: async () => undefined,
    };

    runInNewContext(workerSource, {
      URL,
      Promise,
      caches: {
        open: async () => cache,
        keys: async () => [],
        delete: async () => true,
      },
      fetch: async () => networkResponse,
      self: {
        addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
        location: { origin: "https://example.test" },
      },
    });

    let responsePromise: Promise<unknown> | undefined;
    const backgroundWork: Promise<unknown>[] = [];
    listeners.get("fetch")?.({
      request: { method: "GET", url: "https://example.test/game-art/role.webp" },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
      waitUntil: (promise: Promise<unknown>) => backgroundWork.push(promise),
    });

    const paintResult = await Promise.race([
      responsePromise,
      new Promise((resolvePaint) => setTimeout(() => resolvePaint("cache-blocked-paint"), 30)),
    ]);
    releaseCacheWrite();
    await responsePromise;
    await Promise.all(backgroundWork);

    expect(paintResult).toBe(networkResponse);
    expect(backgroundWork).toHaveLength(1);
  });

  it("discovers and precaches the offline route's hashed styles and image assets", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const addedUrls: string[] = [];
    const storedUrls: string[] = [];
    const offlineHtml = `
      <!doctype html>
      <link rel="stylesheet" href="/_next/static/css/offline.css">
      <script src="/_next/static/chunks/offline.js"></script>
      <img src="/_next/image?url=%2Fgame-art%2Flegal%2Foffline-banner.webp&amp;w=1200&amp;q=75">
    `;
    const cache = {
      addAll: async (urls: string[]) => {
        addedUrls.push(...urls);
      },
      put: async (url: string) => {
        storedUrls.push(url);
      },
      keys: async () => [],
      match: async () => undefined,
    };

    runInNewContext(workerSource, {
      URL,
      Promise,
      Response,
      caches: {
        open: async () => cache,
        keys: async () => [],
        delete: async () => true,
        match: async () => undefined,
      },
      fetch: async (request: string) => {
        if (request === "/offline") {
          return new Response(offlineHtml, { status: 200, headers: { "content-type": "text/html" } });
        }
        throw new Error(`Unexpected fetch: ${request}`);
      },
      self: {
        addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
        location: { origin: "https://example.test" },
      },
    });

    let installWork: Promise<unknown> | undefined;
    listeners.get("install")?.({
      waitUntil: (promise: Promise<unknown>) => {
        installWork = promise;
      },
    });
    await installWork;

    expect(storedUrls).toContain("/offline");
    expect(addedUrls).toContain("/game-art/legal/offline-banner.webp");
    expect(addedUrls).toContain("/game-art/logo-chrome-mark.webp");
    expect(addedUrls).toContain("/game-art/texture-parchment.webp");
    expect(addedUrls).toContain("/game-art/mobile/texture-parchment.webp");
    expect(addedUrls).toContain("/_next/static/css/offline.css");
    expect(addedUrls).toContain("/_next/static/chunks/offline.js");
    expect(addedUrls).not.toContain("/_next/image?url=%2Fgame-art%2Flegal%2Foffline-banner.webp&w=1200&q=75");
  });

  it("serves a precached Next shell asset when the network is unavailable", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const cachedResponse = new Response("offline styles", { status: 200 });

    runInNewContext(workerSource, {
      URL,
      Promise,
      Response,
      caches: {
        open: async () => ({
          addAll: async () => undefined,
          put: async () => undefined,
          keys: async () => [],
          match: async () => undefined,
        }),
        keys: async () => [],
        delete: async () => true,
        match: async () => cachedResponse,
      },
      fetch: async () => {
        throw new Error("offline");
      },
      self: {
        addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
        location: { origin: "https://example.test" },
      },
    });

    let responsePromise: Promise<unknown> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "no-cors",
        url: "https://example.test/_next/static/css/offline.css",
      },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
      waitUntil: () => undefined,
    });

    expect(await responsePromise).toBe(cachedResponse);
  });

  it("falls back from a Next image request to the cached original offline artwork", async () => {
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const originalArtwork = new Response("offline artwork", {
      status: 200,
      headers: { "content-type": "image/webp" },
    });

    runInNewContext(workerSource, {
      URL,
      Promise,
      Response,
      caches: {
        open: async () => ({
          addAll: async () => undefined,
          put: async () => undefined,
          keys: async () => [],
          match: async () => undefined,
        }),
        keys: async () => [],
        delete: async () => true,
        match: async (request: string | { url?: string }) =>
          request === "/game-art/legal/offline-banner.webp" ? originalArtwork : undefined,
      },
      fetch: async () => {
        throw new Error("offline");
      },
      self: {
        addEventListener: (name: string, listener: (event: Record<string, unknown>) => void) => listeners.set(name, listener),
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
        location: { origin: "https://example.test" },
      },
    });

    let responsePromise: Promise<unknown> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "no-cors",
        url: "https://example.test/_next/image?url=%2Fgame-art%2Flegal%2Foffline-banner.webp&w=640&q=75",
      },
      respondWith: (promise: Promise<unknown>) => {
        responsePromise = promise;
      },
      waitUntil: () => undefined,
    });

    expect(await responsePromise).toBe(originalArtwork);
  });
});
