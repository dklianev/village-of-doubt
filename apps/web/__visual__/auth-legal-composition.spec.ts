import { expect, type Page, test } from "playwright/test";
import { expectDecodedImage } from "./image-readiness";

test.use({ serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" } });

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
}

const scenes = [
  { name: "sign-in", query: "", focalY: 0.52, panelOffset: 132 },
  { name: "forgot-password", query: "", focalY: 0.44, panelOffset: 144 },
  { name: "reset-password", query: "?token=synthetic-framing-token", focalY: 0.39, panelOffset: 144 },
  { name: "verify-email", query: "?error=TOKEN_EXPIRED", focalY: 0.48, panelOffset: 144 },
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 600, 640, 768, 800, 1440]) {
    test(`auth focal motifs ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await prepare(page, theme);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      for (const scene of scenes) {
        // Finish each document's session request before navigating away. WebKit
        // otherwise reports its cancelled fetch as a cross-origin page error.
        const session = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/get-session");
        await page.goto(`/${scene.name}${scene.query}`);
        await session;
        await expect(page.locator("main h1:visible")).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.locator(".sign-in-art, [data-recovery-art]").evaluate(async (art, scene) => {
          const style = getComputedStyle(art);
          const box = art.getBoundingClientRect();
          const panel = document.querySelector(".sign-in-panel, .recovery-panel")!.getBoundingClientRect();
          const candidates = Array.from(style.backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
          const requested = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
          const url = candidates.find((candidate) => requested.has(candidate));
          if (!url) throw new Error("Auth artwork was not requested");
          const image = new Image();
          image.src = url;
          await image.decode();
          const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
          const renderedHeight = image.naturalHeight * scale;
          const positionY = parseFloat(style.backgroundPositionY) / 100;
          const imageTop = box.top + (box.height - renderedHeight) * positionY;
          // Source-art landmarks: card eye, key bow, open lock and envelope seal.
          return {
            url, size: style.backgroundSize, artHeight: box.height,
            offset: panel.top - box.top, panelTop: panel.top,
            focalTop: imageTop + renderedHeight * (scene.focalY - 0.04),
            focalBottom: imageTop + renderedHeight * (scene.focalY + 0.04),
            artTop: box.top, panelWidth: panel.width,
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        }, scene);

        expect(geometry.url).toContain(`bg-${scene.name}-${theme}-v2.`);
        expect(geometry.size).toBe("cover");
        expect(geometry.overflow).toBeLessThanOrEqual(0);
        expect(geometry.panelWidth).toBeLessThanOrEqual(440);
        if (width <= 800) {
          expect(geometry.url).toContain("/mobile/auth/");
          expect(geometry.artHeight).toBe(240);
          expect(geometry.offset).toBe(scene.panelOffset);
        } else {
          expect(geometry.url).not.toContain("/mobile/");
          expect(geometry.panelWidth).toBe(440);
        }
        if (width >= 600 && width <= 800) {
          expect(geometry.focalTop).toBeGreaterThan(geometry.artTop);
          expect(geometry.focalBottom).toBeLessThan(geometry.panelTop);
        }
        await testInfo.attach(scene.name, {
          body: await page.screenshot({
            path: testInfo.outputPath(`${scene.name}.png`),
            style: "nextjs-portal { visibility: hidden !important; }",
          }),
          contentType: "image/png",
        });
      }
      expect(errors).toEqual([]);
    });
  }

  for (const width of [390, 640, 1440, 1920]) {
    test(`legal focal crops and image delivery ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await prepare(page, theme);
      for (const route of ["terms", "report", "privacy", "status"] as const) {
        await page.goto(`/${route}`);
        await expect(page.locator(`.${route}-hero`)).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (route !== "status") {
          const image = page.locator(`.${route}-hero-img`);
          await expectDecodedImage(image);
          await expect(image).toHaveCSS("object-position", `50% ${{ terms: 20, report: 12, privacy: 42 }[route]}%`);
          if (route !== "privacy") {
            const srcset = await image.getAttribute("srcset");
            const preload = page.locator(`link[rel="preload"][as="image"][imagesrcset*="${route}-banner"]`);
            await expect(preload).toHaveAttribute("imagesrcset", srcset!);
            await expect(preload).toHaveAttribute("imagesizes", "100vw");
          }
          if (route === "terms" && width >= 1440) {
            const focal = await image.evaluate((element) => {
              const image = element as HTMLImageElement;
              const box = image.getBoundingClientRect();
              const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
              const height = image.naturalHeight * scale;
              const position = parseFloat(getComputedStyle(image).objectPosition.split(" ")[1]!) / 100;
              // The clasp spans the upper third of the source, not its center.
              const top = (box.height - height) * position;
              return { top: top + height * 0.20, bottom: top + height * 0.36, height: box.height };
            });
            expect(focal.top).toBeGreaterThan(0);
            expect(focal.bottom).toBeLessThan(focal.height);
          }
        } else {
          await expect(page.locator('link[rel="preload"][href="/game-art/legal/status-banner.avif"]'))
            .toHaveAttribute("type", "image/avif");
          await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource")
            .filter(entry => entry.name.includes("/game-art/legal/status-banner.")).length)).toBe(1);
        }
        if (route !== "privacy") {
          const requests = await page.evaluate((route) => performance.getEntriesByType("resource")
            .filter((entry) => entry.name.includes(`${route}-banner`)).map((entry) => entry.name), route);
          expect(requests).toHaveLength(1);
          if (route === "status") {
            // The typed preload must let engines without AVIF use image-set's WebP fallback.
            expect(new URL(requests[0]!).pathname).toMatch(/^\/game-art\/legal\/status-banner\.(avif|webp)$/);
            await page.evaluate(async source => {
              const image = new Image();
              image.src = source;
              await image.decode();
            }, requests[0]!);
          } else {
            expect(new URL(requests[0]!).pathname).toBe("/_next/image");
          }
          await expect(page.locator(`link[rel="preload"][href="/game-art/legal/${route}-banner.webp"]`)).toHaveCount(0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await testInfo.attach(route, {
          body: await page.locator(`.${route}-hero`).screenshot({ path: testInfo.outputPath(`${route}.png`) }),
          contentType: "image/png",
        });
      }
    });
  }
}
