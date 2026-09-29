const CACHE_VERSION = "v8";
const SHELL_CACHE_NAME = `werewolf-mafia-shell-${CACHE_VERSION}`;
// A shell-only upgrade does not invalidate already cached artwork.
const ART_CACHE_NAME = "werewolf-mafia-art-v5";
const MAX_ART_ENTRIES = 64;
const NAVIGATION_TIMEOUT_MS = 8_000;
const HEALTH_TIMEOUT_MS = 2_000;
const SHELL_STATIC_URLS = [
  "/favicon.svg",
  "/brand/senkite-wordmark.svg",
  "/brand/senkite-mark.svg",
  "/brand/apple-touch-icon.png",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/game-art/system/offline-lantern-v1.webp",
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
      .then((keys) => Promise.all(keys.filter((key) =>
        (key.startsWith("werewolf-mafia-shell-") || key.startsWith("werewolf-mafia-art-"))
        && ![SHELL_CACHE_NAME, ART_CACHE_NAME].includes(key),
      ).map((key) => caches.delete(key))))
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
    event.respondWith(fetchDocument(event.request));
    return;
  }

  if (requestUrl.pathname === "/_next/image") {
    event.respondWith(fetch(event.request).catch(() => matchNextImageFallback(requestUrl)));
    return;
  }

  if (requestUrl.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(SHELL_CACHE_NAME).then((cache) => cache.match(event.request))
      .then((response) => response ?? fetch(event.request)));
    return;
  }

  if (SHELL_STATIC_URLS.includes(requestUrl.pathname) && requestUrl.pathname.startsWith("/brand/")) {
    event.respondWith(fetch(event.request).catch(() =>
      caches.open(SHELL_CACHE_NAME).then((cache) => cache.match(event.request)).then((response) => response ?? Response.error()),
    ));
    return;
  }

  if (requestUrl.pathname.startsWith("/game-art/") || requestUrl.pathname === "/favicon.svg") {
    const cachePromise = caches.open(ART_CACHE_NAME);
    const networkPromise = fetch(event.request);
    const cacheUpdatePromise = networkPromise.then(async (response) => {
      if (!isCacheableAssetResponse(response)) {
        return;
      }
      const cacheResponse = response.clone();
      const cache = await cachePromise;
      await cache.put(event.request, cacheResponse);
      await trimArtCache(cache);
    });

    event.respondWith(
      networkPromise.catch(() => matchPublicAsset(event.request)),
    );
    event.waitUntil(cacheUpdatePromise.catch(() => undefined));
  }
});

async function fetchDocument(request) {
  const controller = new AbortController();
  const healthController = new AbortController();
  let timeoutId;
  let healthTimeoutId;
  let settled = false;
  try {
    // Only transport failure falls back. Real HTTP errors belong to the requested route.
    return await Promise.race([
      fetch(request, { signal: request.signal
        ? AbortSignal.any([request.signal, controller.signal]) : controller.signal }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(async () => {
          // Slow headers are not an outage. A reachable site gets the native navigation lifetime.
          const health = await Promise.race([
            fetch("/api/health", {
              cache: "no-store", credentials: "omit", redirect: "error", signal: healthController.signal,
            }).catch(() => null),
            new Promise((resolve) => {
              healthTimeoutId = setTimeout(() => {
                healthController.abort();
                resolve(null);
              }, HEALTH_TIMEOUT_MS);
            }),
          ]);
          clearTimeout(healthTimeoutId);
          if (!settled && !health?.ok) {
            controller.abort();
            reject(new Error("Document request timed out while the site was unavailable."));
          }
        }, NAVIGATION_TIMEOUT_MS);
      }),
    ]);
  } catch {
    const cache = await caches.open(SHELL_CACHE_NAME);
    return await cache.match("/offline") ?? Response.error();
  } finally {
    settled = true;
    clearTimeout(timeoutId);
    clearTimeout(healthTimeoutId);
    healthController.abort();
  }
}

async function precacheOfflineShell() {
  const cache = await caches.open(SHELL_CACHE_NAME);
  const response = await fetch("/offline", { cache: "reload", credentials: "omit", redirect: "error" });
  if (!response.ok || response.redirected) {
    throw new Error(`Offline shell request failed with ${response.status}.`);
  }

  const html = await response.clone().text();
  const urls = new Set(extractShellAssetUrls(html));
  // Next can put font preloads in the response Link header instead of the HTML.
  for (const match of (response.headers.get("link") || "").matchAll(/<([^>]+)>/g)) {
    addShellAssetUrl(urls, match[1]);
  }
  const dependencies = new Set();
  await Promise.all([...urls].map(async (url) => {
    const asset = await cacheShellAsset(cache, url);
    if (new URL(url, self.location.origin).pathname.endsWith(".css")) {
      // Fonts referenced only from CSS (including non-preloaded subsets) need a cold cache entry too.
      const css = await asset.text();
      for (const match of css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)) {
        addShellAssetUrl(dependencies, match[1] || match[2] || match[3], new URL(url, self.location.origin));
      }
    }
  }));
  await Promise.all([...dependencies].filter((url) => !urls.has(url)).map((url) => cacheShellAsset(cache, url)));
  await cache.put("/offline", response.clone());
}

async function cacheShellAsset(cache, url) {
  const response = await fetch(url, { cache: "reload", credentials: "omit", redirect: "error" });
  if (!isCacheableAssetResponse(response)) {
    throw new Error("Offline shell asset is not publicly cacheable.");
  }
  await cache.put(url, response.clone());
  return response;
}

function isCacheableAssetResponse(response) {
  return response.ok && !response.redirected
    && !/\b(?:private|no-store)\b/i.test(response.headers.get("cache-control") || "");
}

function extractShellAssetUrls(html) {
  const urls = new Set(SHELL_STATIC_URLS);
  const attributePattern = /\b(?:href|src)=["']([^"']+)["']/gi;

  for (const match of html.matchAll(attributePattern)) {
    addShellAssetUrl(urls, match[1]);
  }
  return [...urls];
}

function addShellAssetUrl(urls, candidate, base = self.location.origin) {
  if (!candidate) {
    return;
  }

  let url;
  try {
    url = new URL(candidate.replaceAll("&amp;", "&"), base);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin || url.username || url.password || !isOfflineShellAsset(url.pathname)) {
    return;
  }
  urls.add(`${url.pathname}${url.search}`);
}

function isOfflineShellAsset(pathname) {
  return pathname.startsWith("/_next/static/") || SHELL_STATIC_URLS.includes(pathname);
}

async function matchNextImageFallback(requestUrl) {
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
  if (sourceUrl.origin !== self.location.origin || sourceUrl.username || sourceUrl.password
    || !(sourceUrl.pathname.startsWith("/game-art/") || SHELL_STATIC_URLS.includes(sourceUrl.pathname))) {
    return Response.error();
  }

  return matchPublicAsset(`${sourceUrl.pathname}${sourceUrl.search}`);
}

async function matchPublicAsset(request) {
  for (const name of [SHELL_CACHE_NAME, ART_CACHE_NAME]) {
    const cache = await caches.open(name);
    const response = await cache.match(request);
    if (response) return response;
  }
  return Response.error();
}

async function trimArtCache(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ART_ENTRIES)).map((key) => cache.delete(key)));
}
