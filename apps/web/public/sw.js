const CACHE_VERSION = "v5";
const SHELL_CACHE_NAME = `werewolf-mafia-shell-${CACHE_VERSION}`;
const ART_CACHE_NAME = `werewolf-mafia-art-${CACHE_VERSION}`;
const MAX_ART_ENTRIES = 64;
const SHELL_STATIC_URLS = [
  "/favicon.svg",
  "/game-art/legal/offline-banner.webp",
  "/game-art/logo-chrome-mark.webp",
  "/game-art/texture-parchment.webp",
  "/game-art/mobile/texture-parchment.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflineShell().then(() => self.skipWaiting()));
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

  if (requestUrl.pathname === "/_next/image") {
    event.respondWith(fetch(event.request).catch(() => matchNextImageFallback(event.request, requestUrl)));
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(event.request).then((response) => response ?? fetch(event.request)));
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
      networkPromise.catch(async () => caches.match(event.request).then((response) => response ?? Response.error())),
    );
    event.waitUntil(cacheUpdatePromise.catch(() => undefined));
  }
});

async function precacheOfflineShell() {
  const cache = await caches.open(SHELL_CACHE_NAME);
  const response = await fetch("/offline", { cache: "reload" });
  if (!response.ok) {
    throw new Error(`Offline shell request failed with ${response.status}.`);
  }

  await cache.put("/offline", response.clone());
  const html = await response.text();
  await cache.addAll(extractShellAssetUrls(html));
}

function extractShellAssetUrls(html) {
  const urls = new Set(SHELL_STATIC_URLS);
  const attributePattern = /\b(?:href|src)=["']([^"']+)["']/gi;

  for (const match of html.matchAll(attributePattern)) {
    addShellAssetUrl(urls, match[1]);
  }

  return [...urls];
}

function addShellAssetUrl(urls, candidate) {
  if (!candidate) {
    return;
  }

  let url;
  try {
    url = new URL(candidate.replaceAll("&amp;", "&"), self.location.origin);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin || !isOfflineShellAsset(url.pathname)) {
    return;
  }
  urls.add(`${url.pathname}${url.search}`);
}

function isOfflineShellAsset(pathname) {
  return pathname.startsWith("/_next/static/") || SHELL_STATIC_URLS.includes(pathname);
}

async function matchNextImageFallback(request, requestUrl) {
  const cachedTransform = await caches.match(request);
  if (cachedTransform) {
    return cachedTransform;
  }

  const source = requestUrl.searchParams.get("url");
  if (!source) {
    return Response.error();
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(source, self.location.origin);
  } catch {
    return Response.error();
  }
  if (sourceUrl.origin !== self.location.origin) {
    return Response.error();
  }

  return caches.match(`${sourceUrl.pathname}${sourceUrl.search}`).then((response) => response ?? Response.error());
}

async function trimArtCache(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ART_ENTRIES)).map((key) => cache.delete(key)));
}
