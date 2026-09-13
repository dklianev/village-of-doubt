import { expect, test, type Page } from "playwright/test";

// Headless Chrome normally hides scrollbars and masks double compensation.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

async function geometry(page: Page) {
  return page.evaluate(() => ({
    scrollY,
    documentHeight: document.documentElement.scrollHeight,
    boxes: [".site-chrome", ".site-brand", "main.play-shell", ".play-interaction-column"].map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  }));
}

function expectStationary(actual: Awaited<ReturnType<typeof geometry>>, before: Awaited<ReturnType<typeof geometry>>) {
  expect(actual.scrollY).toBe(before.scrollY);
  expect(actual.documentHeight).toBe(before.documentHeight);
  for (let index = 0; index < before.boxes.length; index++) {
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(actual.boxes[index]![dimension], `${before.boxes[index]!.selector}: ${dimension}`)
        .toBeCloseTo(before.boxes[index]![dimension], 0);
    }
  }
}

for (const nativeScrollbar of [true, false]) {
  test.describe(nativeScrollbar ? "native scrollbar" : "overlay scrollbar", () => {
    for (const family of ["werewolves", "mafia"] as const) {
      for (const theme of ["light", "dark"] as const) {
        for (const width of nativeScrollbar ? [390, 1023, 1440] : [390, 1440]) {
          test(`tools preserve navbar and page ${family} ${theme} ${width}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 600 });
            await page.addInitScript((theme) => {
              localStorage.setItem("werewolf-theme", theme);
              localStorage.setItem("cookie-consent", "1");
              localStorage.setItem("welcome-modal-shown", "1");
            }, theme);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=12&voteTally=full`);
            if (!nativeScrollbar) await page.addStyleTag({ content: "html { scrollbar-width: none; }" });
            await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
            await expect(page.locator('.play-personal-area .role-card')).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
            const tools = page.locator(".play-console-tools");
            for (const [name, title] of [[/^Правила$/, "Правила на масата"], [/Сигнали/, "Сигнали за фазите"]] as const) {
              const trigger = tools.getByRole("button", { name });
              await trigger.scrollIntoViewIfNeeded();
              await page.evaluate(() => scrollTo(0, Math.min(180, document.documentElement.scrollHeight - innerHeight)));
              await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
              const before = await geometry(page);
              expect.soft(before.boxes[0]!.y, "Navbar stays pinned after page scrolling").toBe(0);
              if (nativeScrollbar) {
                expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(0);
              }
              for (let attempt = 0; attempt < 2; attempt++) {
                await trigger.click();
                const dialog = page.getByRole("dialog", { name: title });
                await expect(dialog).toBeVisible();
                await expect(page.locator("body")).toHaveAttribute("data-scroll-locked");
                expectStationary(await geometry(page), before);
                // The page behind the modal must remain locked to wheel input.
                await page.mouse.move(2, 300);
                await page.mouse.wheel(0, 400);
                await page.waitForTimeout(100);
                expectStationary(await geometry(page), before);
                if (attempt === 0) await page.screenshot({ path: info.outputPath(`${title}-open.png`), animations: "disabled" });
                if (attempt === 0) await page.keyboard.press("Escape");
                else await dialog.getByRole("button", { name: "Затвори", exact: true }).click();
                await expect(dialog).not.toBeVisible();
                await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
                await expect(trigger).toBeFocused();
                expectStationary(await geometry(page), before);
              }
            }
            expect(errors).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          });
        }
      }
    }
  });
}
