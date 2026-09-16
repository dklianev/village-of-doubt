import { createRequire } from "node:module";

const webRequire = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { JSDOM } = webRequire("jsdom");

export async function assertStaticCss(body, pageUrl, label, fetchAsset = fetch) {
  const document = JSDOM.fragment(body);
  const assetUrls = [...new Set(
    [...document.querySelectorAll('link[rel~="stylesheet"][href]')]
      .map((link) => new URL(link.getAttribute("href"), pageUrl))
      .filter((url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".css"))
      .map((url) => url.href),
  )];

  if (assetUrls.length === 0) {
    throw new Error(`${label} did not include a Next.js CSS asset`);
  }

  const stylesheets = [];
  for (const assetUrl of assetUrls) {
    const response = await fetchAsset(assetUrl);
    const css = await response.text();
    if (!response.ok || !response.headers.get("content-type")?.includes("text/css") || !css.trim()) {
      throw new Error(`${label} failed: ${assetUrl} returned HTTP ${response.status} without valid CSS`);
    }
    stylesheets.push(css);
  }

  // Chunk order and boundaries are build details, not an asset-delivery contract.
  const css = stylesheets.join("\n");
  if (css.length < 100 || !css.includes("image-set") || !css.includes(".webp")) {
    throw new Error(`${label} did not include optimized image-set WebP references`);
  }
}
