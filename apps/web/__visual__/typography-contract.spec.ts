import { expect, test } from "playwright/test";

test("Bulgarian display and interface text use self-hosted fonts without external requests", async ({ page }) => {
  const remoteFonts: string[] = [];
  page.on("request", (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) remoteFonts.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const { root } = await session.send("DOM.getDocument");
  for (const [selector, family] of [["h1", "Literata"], [".site-play-cta", "Sofia"]] as const) {
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    const { fonts } = await session.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.some((font) => font.isCustomFont && font.familyName.includes(family) && font.glyphCount > 0)).toBe(true);
  }
  expect(remoteFonts).toEqual([]);
  const deliveredFonts = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((entry) => /\.woff2(?:\?|$)/.test(entry.name))
    .map((entry) => ({ url: entry.name, bytes: (entry as PerformanceResourceTiming).encodedBodySize })));
  expect(deliveredFonts).toHaveLength(2);
  expect(deliveredFonts.reduce((bytes, font) => bytes + font.bytes, 0)).toBeLessThan(125 * 1024);
  await session.detach();
});
