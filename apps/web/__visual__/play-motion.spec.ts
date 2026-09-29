import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 768, 1440]) {
      for (const reducedMotion of ["reduce", "no-preference"] as const) {
        test(`play motion: ${family} ${theme} ${width} ${reducedMotion}`, async ({ page }, testInfo) => {
          const errors: string[] = [];
          const requests: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("request", (request) => requests.push(new URL(request.url()).pathname));
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ reducedMotion, colorScheme: theme });
          await page.addInitScript((theme) => {
            localStorage.setItem("werewolf-theme", theme);
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("welcome-modal-shown", "1");
          }, theme);
          await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=night&players=9`);
          await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page).toHaveTitle(/Сенките/);
          await page.evaluate(() => document.fonts.ready);

          // Present only the transient DOM for CSS inspection. ACK/phase ownership
          // is independently exercised by the hook and orchestrator unit tests.
          await page.locator("main").evaluate((main, family) => {
            const overlay = document.createElement("div");
            overlay.className = "phase-transition-overlay transition-night";
            overlay.dataset.family = family;
            overlay.setAttribute("role", "status");
            overlay.innerHTML = '<div><span aria-hidden="true">N</span><strong>Нощ</strong><small>Селото спи, но гората не.</small></div>';
            main.append(overlay);
            const receipt = document.createElement("div");
            receipt.className = "play-action-receipt";
            receipt.textContent = "Нощният ход е приет";
            main.append(receipt);
            for (const element of [overlay, receipt]) for (const animation of element.getAnimations({ subtree: true })) {
              animation.pause();
              animation.currentTime = 120;
            }
          }, family);
          const overlay = page.locator(".phase-transition-overlay");
          const receipt = page.locator(".play-action-receipt");
          expect(await overlay.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
          expect(await overlay.evaluate((element) => getComputedStyle(element).backgroundImage)).toBe("none");
          if (reducedMotion === "reduce") {
            expect(await overlay.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
            expect(await receipt.evaluate((element) => element.getAnimations().length)).toBe(0);
            expect((await overlay.boundingBox())!.width).toBe(1);
            expect(await page.locator(".play-stage").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
          } else {
            expect(await receipt.evaluate((element) => element.getAnimations().map((animation) => animation.effect!.getTiming().duration))).toEqual([240]);
            expect(await overlay.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
            const bounds = await overlay.locator("strong").boundingBox();
            expect(bounds!.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
            await overlay.evaluate(async (element) => {
              for (const animation of element.getAnimations({ subtree: true })) animation.finish();
              await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            });
            expect(await overlay.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
          }
          expect(requests.filter((path) => /\/game-art\/(mobile\/)?transition-/.test(path))).toEqual([]);

          await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=game_over&winner=${family}&players=6&jesterWin=1`);
          await page.waitForFunction(() => document.activeElement?.id === "conclusion-heading");
          const finale = page.locator("[data-endgame]");
          await expect(finale).toBeVisible();
          await expect(overlay).toHaveCount(0);
          const heading = finale.locator("h1");
          const art = finale.locator('img[src$="jester-v1.webp"]');
          const actions = finale.locator(".play-winner-actions");
          const before = await actions.boundingBox();
          if (reducedMotion === "reduce") {
            expect(await finale.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
          } else {
            expect(await heading.evaluate((element) => element.getAnimations().map((animation) => animation.effect!.getTiming().duration))).toEqual([420]);
            expect(await art.evaluate((element) => element.getAnimations().map((animation) => animation.effect!.getTiming().delay))).toEqual([120]);
            await finale.evaluate((element) => {
              for (const animation of element.getAnimations({ subtree: true })) {
                animation.pause();
                animation.currentTime = 0;
              }
            });
          }
          const firstLink = actions.getByRole("link").first();
          await expect(firstLink).toBeVisible();
          await firstLink.click({ trial: true });
          await page.keyboard.press("Tab");
          await expect(firstLink).toBeFocused();
          expect(await actions.evaluate((element) => element.getAnimations({ subtree: true })
            .filter((animation) => animation instanceof CSSAnimation).length)).toBe(0);
          expect(await firstLink.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
          await finale.evaluate(async (element) => {
            for (const animation of element.getAnimations({ subtree: true })) animation.finish();
            await document.fonts.ready;
            for (const image of element.querySelectorAll("img")) await image.decode();
          });
          const after = await actions.boundingBox();
          expect(after!.width).toBeCloseTo(before!.width, 0);
          expect(await heading.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
          expect(await heading.evaluate((element) => {
            const transform = getComputedStyle(element).transform;
            return transform === "none" || new DOMMatrix(transform).isIdentity;
          })).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          await page.screenshot({ path: testInfo.outputPath("finale-motion-settled.png"), fullPage: false });
          expect(errors).toEqual([]);
        });
      }
    }
  }
}
