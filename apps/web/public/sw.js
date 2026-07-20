const CACHE_VERSION = "v3";
const SHELL_CACHE_NAME = `werewolf-mafia-shell-${CACHE_VERSION}`;
const ART_CACHE_NAME = `werewolf-mafia-art-${CACHE_VERSION}`;
const MAX_ART_ENTRIES = 64;
const SHELL_URLS = ["/", "/offline", "/werewolf", "/mafia", "/werewolf/rules", "/mafia/rules", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE_NAME, ART_CACHE_NAME].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
    return;
  }

  if (requestUrl.pathname.startsWith("/game-art/") || requestUrl.pathname === "/favicon.svg") {
    const cachePromise = caches.open(ART_CACHE_NAME);
    const networkPromise = fetch(event.request);
    const cacheUpdatePromise = networkPromise.then(async (response) => {
      if (!response.ok) {
        return;
      }
      const cacheResponse = response.clone();
      const cache = await cachePromise;
      await cache.put(event.request, cacheResponse);
      await trimArtCache(cache);
    });

    event.respondWith(
      networkPromise.catch(async () => (await cachePromise).match(event.request).then((response) => response ?? Response.error())),
    );
    event.waitUntil(cacheUpdatePromise.catch(() => undefined));
  }
});

async function trimArtCache(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ART_ENTRIES)).map((key) => cache.delete(key)));
}
