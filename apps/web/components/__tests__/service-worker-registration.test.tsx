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

  it("versions, bounds, and refreshes the artwork cache from the network", () => {
    expect(workerSource).toContain('const CACHE_VERSION = "v4"');
    expect(workerSource).toContain('const SHELL_URLS = ["/offline"]');
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
});
