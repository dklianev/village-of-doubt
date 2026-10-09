import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const workerSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const origin = "https://example.test";
type CacheKey = string | { url: string };
type WorkerEvent = Record<string, unknown>;

function createWorker(html = "<html>Public offline shell</html>", link = "") {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const storage = new Map<string, Map<string, Response>>();
  const keyOf = (key: CacheKey) => new URL(typeof key === "string" ? key : key.url, origin).href;
  const open = vi.fn(async (name: string) => {
    if (!storage.has(name)) storage.set(name, new Map());
    const entries = storage.get(name)!;
    return {
      match: async (key: CacheKey) => entries.get(keyOf(key))?.clone(),
      put: async (key: CacheKey, response: Response) => { entries.set(keyOf(key), response.clone()); },
      keys: async () => [...entries.keys()].map((url) => ({ url })),
      delete: async (key: CacheKey) => entries.delete(keyOf(key)),
    };
  });
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const pathname = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, origin).pathname;
    return pathname === "/offline"
      ? new Response(html, { headers: { "content-type": "text/html", link } })
      : new Response(`asset:${pathname}`, { headers: { "cache-control": "public, max-age=31536000" } });
  });
  const skipWaiting = vi.fn();
  runInNewContext(workerSource, {
    URL, Response, Promise, AbortController, AbortSignal, setTimeout, clearTimeout,
    fetch: fetchMock,
    caches: {
      open,
      keys: async () => [...storage.keys()],
      delete: async (name: string) => storage.delete(name),
    },
    self: {
      location: { origin },
      addEventListener: (name: string, listener: (event: WorkerEvent) => void) => listeners.set(name, listener),
      skipWaiting,
      clients: { claim: vi.fn() },
    },
  });
  async function lifecycle(name: string) {
    let work: Promise<unknown> | undefined;
    listeners.get(name)!({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
  }
  function request(path: string, mode = "no-cors", method = "GET", signal?: AbortSignal) {
    let response: Promise<Response> | undefined;
    const work: Promise<unknown>[] = [];
    listeners.get("fetch")!({
      request: { method, mode, url: new URL(path, origin).href, signal },
      respondWith: (promise: Promise<Response>) => { response = promise; },
      waitUntil: (promise: Promise<unknown>) => { work.push(promise); },
    });
    return { response, done: () => Promise.all(work) };
  }
  return { storage, open, fetchMock, skipWaiting, lifecycle, request };
}

afterEach(() => { vi.useRealTimers(); });

describe("offline service worker reliability", () => {
  it.each([10_000, 60_000])("allows a reachable document with %s ms headers to finish when health is healthy", async (delay) => {
    vi.useFakeTimers();
    const worker = createWorker();
    await worker.lifecycle("install");
    const documentResponse = new Response("slow destination", { headers: { "cache-control": "private, no-store" } });
    worker.fetchMock.mockClear().mockImplementation((input) => typeof input === "string"
      ? Promise.resolve(new Response(null, { status: 200 }))
      : new Promise((resolve) => { setTimeout(() => resolve(documentResponse), delay); }));
    const response = worker.request("/account?synthetic=1", "navigate").response;
    await vi.advanceTimersByTimeAsync(delay);

    expect(await response).toBe(documentResponse);
    expect(worker.fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    expect([...worker.storage.values()].every((entries) => !entries.has(`${origin}/account?synthetic=1`))).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cold-caches header-only fonts and CSS font subsets without a warmed HTTP cache", async () => {
    const worker = createWorker(`
      <html><link rel="stylesheet" href="/_next/static/css/offline.css">
      <script src="/_next/static/chunks/offline.js"></script></html>
    `, '</_next/static/media/display.woff2>; rel=preload; as="font"; crossorigin="", '
      + '<https://example.test/_next/static/media/interface.woff2>; rel=preload; as=font');
    const initialFetch = worker.fetchMock.getMockImplementation()!;
    worker.fetchMock.mockImplementation(async (input, init) => input === "/_next/static/css/offline.css"
      ? new Response(`
        @font-face { src: url('../media/interface.woff2') format('woff2'); }
        @font-face { src: url("/_next/static/media/cyrillic.woff2") format('woff2'); }
        @font-face { src: url(../media/italic.woff2); }
      `, { headers: { "content-type": "text/css" } })
      : initialFetch(input, init));

    expect(worker.storage.size).toBe(0);
    await worker.lifecycle("install");
    expect(worker.skipWaiting).toHaveBeenCalledTimes(1);
    expect(worker.fetchMock).toHaveBeenCalledWith("/offline", {
      cache: "reload", credentials: "omit", redirect: "error",
    });
    for (const font of ["display", "interface", "cyrillic", "italic"]) {
      expect(worker.fetchMock.mock.calls.filter(([url]) => url === `/_next/static/media/${font}.woff2`)).toHaveLength(1);
      expect(worker.fetchMock).toHaveBeenCalledWith(`/_next/static/media/${font}.woff2`, {
        cache: "reload", credentials: "omit", redirect: "error",
      });
    }

    worker.fetchMock.mockClear().mockRejectedValue(new TypeError("Disconnected"));
    for (const font of ["display", "interface", "cyrillic", "italic"]) {
      const response = await worker.request(`/_next/static/media/${font}.woff2`).response;
      expect(response?.ok).toBe(true);
      expect(await response?.text()).toBe(`asset:/_next/static/media/${font}.woff2`);
    }
    expect(worker.fetchMock).not.toHaveBeenCalled();
    const fallback = await worker.request("/play/ABC234?mode=werewolf", "navigate").response;
    expect(await fallback?.text()).toContain("/_next/static/css/offline.css");
  });

  it("discovers only same-origin public assets from HTML, Link headers and CSS", async () => {
    const worker = createWorker(`
      <link href="/_next/static/css/offline.css">
      <a href="/account">Profile</a><script src="/api/private"></script>
      <img src="/_next/image?url=%2Fapi%2Fprivate">
      <img src="https://external.test/_next/static/remote.js">
    `, '</api/auth/session>; rel=preload, <https://external.test/_next/static/font.woff2>; rel=preload, '
      + '<https://name:synthetic@example.test/_next/static/credentialed.woff2>; rel=preload');
    const initialFetch = worker.fetchMock.getMockImplementation()!;
    worker.fetchMock.mockImplementation(async (input, init) => input === "/_next/static/css/offline.css"
      ? new Response("a { background: url('/api/private'); } b { background: url('https://external.test/image.png'); }")
      : initialFetch(input, init));

    await worker.lifecycle("install");

    expect(worker.fetchMock.mock.calls.every(([url]) => typeof url === "string" && (
      url === "/offline" || url.startsWith("/_next/static/") || url.startsWith("/brand/")
      || url.startsWith("/game-art/") || url === "/favicon.svg"
    ))).toBe(true);
    expect(worker.fetchMock.mock.calls.some(([url]) => String(url).includes("credentialed"))).toBe(false);
    expect([...worker.storage.values()].flatMap((entries) => [...entries.keys()]).some((url) => url.includes("/api/"))).toBe(false);
  });

  it.each([404, 503])("rejects an HTTP %s shell install without activating an incomplete cache", async (status) => {
    const worker = createWorker();
    worker.fetchMock.mockResolvedValue(new Response(null, { status }));

    await expect(worker.lifecycle("install")).rejects.toThrow("Offline shell request failed");

    expect(worker.skipWaiting).not.toHaveBeenCalled();
    expect([...worker.storage.values()].every((entries) => entries.size === 0)).toBe(true);
  });

  it.each(["private", "no-store", "http-error", "redirect"])("rejects %s shell assets during a cold install", async (failure) => {
    const worker = createWorker("<link href='/_next/static/css/offline.css'>");
    const initialFetch = worker.fetchMock.getMockImplementation()!;
    worker.fetchMock.mockImplementation(async (input, init) => {
      if (input !== "/_next/static/css/offline.css") return initialFetch(input, init);
      const response = new Response("not a public asset", {
        status: failure === "http-error" ? 503 : 200,
        headers: { "cache-control": failure },
      });
      if (failure === "redirect") Object.defineProperty(response, "redirected", { value: true });
      return response;
    });

    await expect(worker.lifecycle("install")).rejects.toThrow("not publicly cacheable");

    expect(worker.skipWaiting).not.toHaveBeenCalled();
    expect([...worker.storage.values()].every((entries) => !entries.has(`${origin}/offline`))).toBe(true);
  });

  it.each([200, 404, 503])("returns an actual HTTP %s navigation response instead of the cached fallback", async (status) => {
    vi.useFakeTimers();
    const worker = createWorker();
    await worker.lifecycle("install");
    const response = new Response("requested document", { status });
    worker.fetchMock.mockResolvedValue(response);

    expect(await worker.request("/missing?from=test", "navigate").response).toBe(response);
    expect(vi.getTimerCount()).toBe(0);
    expect([...worker.storage.values()].every((entries) => !entries.has(`${origin}/missing?from=test`))).toBe(true);
  });

  it("bounds a stalled document plus stalled health probe and ignores late responses", async () => {
    vi.useFakeTimers();
    const worker = createWorker();
    await worker.lifecycle("install");
    let resolveNetwork!: (response: Response) => void;
    let resolveHealth!: (response: Response) => void;
    worker.fetchMock.mockClear().mockImplementation((input) => new Promise((resolveResponse) => {
      if (input === "/api/health") resolveHealth = resolveResponse;
      else resolveNetwork = resolveResponse;
    }));
    const response = worker.request("/play/ABC234?mode=werewolf", "navigate").response!;
    const settled = vi.fn();
    void response.then(settled);

    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(worker.fetchMock).toHaveBeenCalledWith("/api/health", {
      cache: "no-store", credentials: "omit", redirect: "error", signal: expect.any(AbortSignal),
    });
    expect(worker.fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(worker.fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(worker.fetchMock.mock.calls[1]![1]!.signal!.aborted).toBe(true);
    expect(await (await response).text()).toContain("Public offline shell");
    resolveNetwork(new Response("late document"));
    resolveHealth(new Response("late health"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(settled).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([404, 503, "network"])("falls back at eight seconds when health fails with %s", async (failure) => {
    vi.useFakeTimers();
    const worker = createWorker();
    await worker.lifecycle("install");
    worker.fetchMock.mockClear().mockImplementation((input) => {
      if (input !== "/api/health") return new Promise(() => {});
      return failure === "network" ? Promise.reject(new TypeError("Offline"))
        : Promise.resolve(new Response(null, { status: Number(failure) }));
    });
    const response = worker.request("/account", "navigate").response;
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await (await response)?.text()).toContain("Public offline shell");
    expect(worker.fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not abort a document body that wins while the health probe is pending", async () => {
    vi.useFakeTimers();
    const worker = createWorker();
    await worker.lifecycle("install");
    let resolveNetwork!: (response: Response) => void;
    worker.fetchMock.mockClear().mockImplementation((input, init) => input === "/api/health"
      ? new Promise((_, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("Abort"))); })
      : new Promise((resolve) => { resolveNetwork = resolve; }));
    const response = worker.request("/account", "navigate").response;
    await vi.advanceTimersByTimeAsync(8_100);
    const documentResponse = new Response("streaming destination");
    resolveNetwork(documentResponse);
    expect(await response).toBe(documentResponse);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(worker.fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    expect(worker.fetchMock.mock.calls[1]![1]!.signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("forwards navigation cancellation to the document transport", async () => {
    vi.useFakeTimers();
    const worker = createWorker();
    await worker.lifecycle("install");
    const navigation = new AbortController();
    worker.fetchMock.mockClear().mockImplementation((_, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("Abort")));
    }));
    const response = worker.request("/account", "navigate", "GET", navigation.signal).response;
    navigation.abort();
    expect(await (await response)?.text()).toContain("Public offline shell");
    expect(worker.fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a network error when no offline shell was successfully installed", async () => {
    const worker = createWorker();
    worker.fetchMock.mockRejectedValue(new TypeError("Disconnected"));

    const response = await worker.request("/account", "navigate").response;

    expect(response?.type).toBe("error");
    expect(response?.status).toBe(0);
  });

  it.each([
    ["/api/health", "cors", "GET"],
    ["/api/auth/session", "cors", "GET"],
    ["/play/ABC234?_rsc=synthetic", "cors", "GET"],
    ["/account", "cors", "GET"],
    ["/account", "navigate", "POST"],
    ["https://external.test/game-art/private.webp", "no-cors", "GET"],
  ])("does not intercept or cache %s (%s, %s)", (url, mode, method) => {
    const worker = createWorker();

    expect(worker.request(url, mode, method).response).toBeUndefined();
    expect(worker.open).not.toHaveBeenCalled();
    expect(worker.fetchMock).not.toHaveBeenCalled();
  });

  it("does not read other caches or private originals through the image optimizer fallback", async () => {
    const worker = createWorker();
    const foreign = await worker.open("unrelated-cache");
    await foreign.put("/api/private", new Response("synthetic private data"));
    await foreign.put("/game-art/unknown.webp", new Response("unrelated artwork"));
    worker.fetchMock.mockRejectedValue(new TypeError("Disconnected"));
    worker.open.mockClear();

    for (const source of ["/api/private", "https://external.test/game-art/a.webp", "/game-art/unknown.webp"]) {
      const response = await worker.request(`/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`).response;
      expect(response?.type).toBe("error");
    }
    expect(worker.open).not.toHaveBeenCalledWith("unrelated-cache");
  });

  it("serves the public original artwork when the image optimizer is offline", async () => {
    const worker = createWorker();
    await worker.lifecycle("install");
    worker.fetchMock.mockRejectedValue(new TypeError("Disconnected"));

    const response = await worker.request("/_next/image?url=%2Fgame-art%2Fsystem%2Foffline-lantern-v1.webp&w=640&q=75").response;

    expect(await response?.text()).toBe("asset:/game-art/system/offline-lantern-v1.webp");
  });

  it.each(["private", "no-store", "http-error", "redirect"])("does not cache %s runtime artwork", async (failure) => {
    const worker = createWorker();
    const response = new Response("uncacheable artwork", {
      status: failure === "http-error" ? 503 : 200,
      headers: { "cache-control": failure },
    });
    if (failure === "redirect") Object.defineProperty(response, "redirected", { value: true });
    worker.fetchMock.mockResolvedValue(response);
    const request = worker.request("/game-art/fixture.webp");

    expect(await request.response).toBe(response);
    await request.done();

    expect([...worker.storage.values()].every((entries) => entries.size === 0)).toBe(true);
  });

  it("bounds runtime artwork and preserves the installed shell across cache cleanup", async () => {
    const worker = createWorker();
    await worker.lifecycle("install");
    for (let index = 0; index < 68; index += 1) {
      const request = worker.request(`/game-art/fixture-${index}.webp`);
      await request.response;
      await request.done();
    }
    const art = [...worker.storage].find(([name]) => name.startsWith("werewolf-mafia-art-"))![1];
    expect(art.size).toBe(64);
    expect(art.has(`${origin}/game-art/fixture-0.webp`)).toBe(false);
    await worker.open("werewolf-mafia-shell-obsolete");
    await worker.open("unrelated-cache");

    await worker.lifecycle("activate");

    expect(worker.storage.has("werewolf-mafia-shell-obsolete")).toBe(false);
    expect(worker.storage.has("unrelated-cache")).toBe(true);
    expect([...worker.storage.values()].some((entries) => entries.has(`${origin}/offline`))).toBe(true);
    expect([...worker.storage.values()].some((entries) => entries === art)).toBe(true);
  });
});
