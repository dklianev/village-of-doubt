import sharp from "sharp";

export async function assertOptimizedImage(sourceUrl, width, label, fetchAsset = fetch) {
  const source = new URL(sourceUrl);
  const original = await readImageMetadata(source.href, label, fetchAsset);
  if (!original.width || !original.height || original.width <= width) {
    throw new Error(`${label}: source must be wider than ${width}px to verify resizing`);
  }

  const optimizedUrl = new URL("/_next/image", source);
  optimizedUrl.search = new URLSearchParams({
    url: `${source.pathname}${source.search}`,
    w: String(width),
    q: "75",
  }).toString();
  const optimized = await readImageMetadata(optimizedUrl.href, label, fetchAsset);
  const height = Math.round(original.height * width / original.width);
  // Next can return HTTP 200 with the original bytes when Sharp cannot load.
  if (optimized.width !== width || optimized.height !== height) {
    throw new Error(
      `${label}: expected ${width}x${height}, received ${optimized.width}x${optimized.height}; image optimization may have fallen back to the original`,
    );
  }
}

async function readImageMetadata(url, label, fetchAsset) {
  const response = await fetchAsset(url, {
    headers: { accept: "image/webp" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`${label}: ${url} returned HTTP ${response.status} without a valid image content type`);
  }
  try {
    return await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  } catch (cause) {
    throw new Error(`${label}: ${url} did not contain a decodable image`, { cause });
  }
}
