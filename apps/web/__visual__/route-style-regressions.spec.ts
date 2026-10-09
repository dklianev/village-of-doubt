import { expect, test, type Page } from "playwright/test";

test.use({ contextOptions: { serviceWorkers: "block", reducedMotion: "reduce" } });

async function prepare(page: Page, theme: string) {
  await page.addInitScript((value) => {
    for (const [key, entry] of Object.entries({
      "werewolf-theme": value,
      "cookie-consent": "1",
      "welcome-modal-shown": "1",
      "tutorial-completed": "1",
    })) localStorage.setItem(key, entry);
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
}

async function ready(page: Page) {
  await expect(page.locator("main h1:visible").first()).toBeVisible();
  await expect(page.locator('.auth-chip-slot[data-auth-state="guest"]').first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
}

async function homeStyles(page: Page) {
  return page.evaluate(() => {
    const properties = ["backgroundColor", "backgroundImage", "color", "paddingBottom", "display", "opacity"] as const;
    const style = (element: Element, pseudo?: string) => {
      const computed = getComputedStyle(element, pseudo);
      return Object.fromEntries(properties.map((key) => [key, computed[key]]));
    };
    return {
      body: style(document.body),
      before: style(document.body, "::before"),
      after: style(document.body, "::after"),
      footer: style(document.querySelector(".site-footer")!),
    };
  });
}

for (const theme of ["light", "dark"]) {
  for (const width of [320, 390, 768, 1440]) {
    test(`sport nominations and sheet motion ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      await prepare(page, theme);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/play/VISUAL?visualGame=1&family=mafia&mode=mafia_sport&phase=voting&players=10&voteTally=full");
      await expect(page.getByRole("article", { name: /Тайна роля/ })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("[data-seat-day-status]")).toHaveCount(2);
      await page.locator('button[data-nominee="true"]').first().click();
      await expect(page.locator('button[data-nominee="true"]').first()).toHaveAttribute("aria-pressed", "true");

      const geometry = await page.locator("[data-seat-token]").evaluateAll((seats) => {
        const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
          && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        const markers = seats.flatMap((seat) => [...seat.querySelectorAll("[data-seat-day-status]")]);
        return {
          markerCollisions: markers.flatMap((marker, i) => markers.slice(i + 1).filter((other) => overlaps(marker.getBoundingClientRect(), other.getBoundingClientRect()))).length,
          counterCollisions: seats.filter((seat) => {
            const marker = seat.querySelector("[data-seat-day-status]");
            return marker && [...seat.querySelectorAll("[data-seat-vote-count], [class*=selectedMark]")]
              .some((counter) => overlaps(marker.parentElement!.getBoundingClientRect(), counter.getBoundingClientRect()));
          }).length,
          // Only the expanded mobile vote sheet may cover lower seats; it lists every nominee itself.
          hiddenCounts: seats.flatMap((seat) => [...seat.querySelectorAll("[data-seat-vote-count]")]).filter((count) => {
            const box = count.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            if (matchMedia("(max-width: 1023px)").matches
              && hit?.closest('[data-play-command-surface][data-compact="true"][data-expanded="true"]')) return false;
            return !hit || (hit !== count && !count.contains(hit));
          }).length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry).toEqual({ markerCollisions: 0, counterCollisions: 0, hiddenCounts: 0, overflow: false });
      await page.screenshot({ path: testInfo.outputPath(`table-${theme}-${width}.png`), style: "nextjs-portal{display:none}" });

      const conversation = page.getByRole("button", { name: "Към разговора", exact: true });
      if (await conversation.isVisible()) await conversation.click();
      const rules = page.getByRole("button", { name: "Правила", exact: true });
      await rules.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
      expect(await dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
      await expect(page.locator("body")).toHaveAttribute("data-scroll-locked", "1");
      await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(rules).toBeFocused();
      await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
      await page.getByRole("button", { name: /Сигнали.*Визуално/ }).click();
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  for (const width of [390, 1440]) {
    test(`cached pages do not restyle home ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, theme);
      await page.goto("/");
      await ready(page);
      const fresh = await homeStyles(page);
      for (const source of ["/werewolf/create?visualAuth=1", "/faq", "/tutorial?step=1", "/werewolf/roles"]) {
        await page.goto(source);
        await ready(page);
        expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
        if (source.includes("/create")) await expect(page.locator(".lobby-wizard:not([inert])")).toBeVisible();
        await page.getByRole("link", { name: "Сенките, начало", exact: true }).click();
        await expect(page).toHaveURL("/");
        await expect(page.locator('.site-chrome')).toHaveAttribute("data-route", "/");
        await expect(page.locator("main.landing-shell")).toBeVisible();
        expect(await homeStyles(page), source).toEqual(fresh);
      }
      await page.locator(".landing-final-cta").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`home-${theme}-${width}.png`), style: "nextjs-portal{display:none}" });
    });

    for (const route of ["/account?visualAuth=1", "/achievements?visualAuth=1&visualAchievements=fixture"]) {
      test(`ambient reduced motion ${route} ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await prepare(page, theme);
        await page.goto(route);
        await ready(page);
        const before = await page.evaluate(() => {
          const style = getComputedStyle(document.body, "::before");
          return { animation: style.animationName, transform: style.transform, image: style.backgroundImage, display: style.display };
        });
        expect(before.animation).toBe("none");
        expect(before.image).not.toBe("none");
        expect(before.display).not.toBe("none");
        await page.waitForTimeout(1100);
        expect(await page.evaluate(() => getComputedStyle(document.body, "::before").transform)).toBe(before.transform);
        await page.screenshot({ path: testInfo.outputPath(`ambient-${theme}-${width}.png`), style: "nextjs-portal{display:none}" });
      });
    }
  }
}
