import { expect, test, type Page } from "playwright/test";

declare global {
  interface Window {
    __themeTransitionCalls: number;
  }
}

test.use({ serviceWorkers: "block" });

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    window.__themeTransitionCalls = 0;
    const start = document.startViewTransition?.bind(document);
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: (...args: Parameters<Document["startViewTransition"]>) => {
        window.__themeTransitionCalls++;
        if (!start) throw new Error("View transitions unavailable");
        return start(...args);
      },
    });
  }, theme);
}

for (const { family, role, name } of [
  { family: "werewolves", role: "seer", name: "Гадателка" },
  { family: "mafia", role: "commissioner", name: "Комисар" },
]) {
  for (const { width, theme } of [
    { width: 1440, theme: "dark" },
    { width: 390, theme: "light" },
  ] as const) {
    test(`room theme privacy ${family} ${width} ${theme}: no snapshots and immediate role hiding`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: theme });
      await prepare(page, theme);
      await page.goto(`/play/VISUAL?visualGame=1&family=${family}&role=${role}&phase=night&players=8`);
      await expect(page).toHaveURL(/\/play\/VISUAL\?/);
      await expect(page).toHaveTitle(/Сенките/);
      await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const personal = page.locator(".play-personal-area");
      const card = personal.locator("[data-private-dossier]");
      await expect(card).toBeVisible();
      await expect(card).toContainText(name);
      const mobile = width < 1024;
      const drawer = page.getByRole("dialog", { name: "Навигация" });
      const menu = page.getByRole("button", { name: "Отвори менюто", exact: true });
      async function openThemeControl() {
        if (mobile) {
          await menu.click();
          await expect(drawer).toBeVisible();
        }
        const button = (mobile ? drawer : page.locator(".site-chrome .site-utility-cluster"))
          .getByRole("button", { name: /Смени на .* тема/ });
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
        return button;
      }
      async function closeThemeControl() {
        if (!mobile) return;
        await drawer.getByRole("button", { name: "Затвори менюто", exact: true }).click();
        await expect(drawer).toBeHidden();
        await expect(menu).toBeFocused();
      }
      const button = await openThemeControl();
      const next = theme === "dark" ? "light" : "dark";

      await button.focus();
      await button.press("Enter");
      await expect(button).toBeFocused();
      await expect(button).toHaveAccessibleName(next === "light" ? "Смени на тъмна тема" : "Смени на светла тема");
      await expect(page.locator("html")).toHaveAttribute("data-theme", next);
      await closeThemeControl();
      await expect(card).toBeVisible();

      const hide = personal.getByRole("button", { name: "Скрий ролята", exact: true });
      await hide.focus();
      const hidden = await hide.evaluate(async (element: HTMLButtonElement) => {
        // Inspect the real React state after its microtask, before another paint.
        element.click();
        await Promise.resolve();
        return {
          privateNodes: document.querySelectorAll("[data-private-dossier], .role-card-result, .play-private-conversation").length,
          label: element.getAttribute("aria-label"),
          focused: document.activeElement === element,
          snapshots: window.__themeTransitionCalls,
        };
      });
      expect(hidden).toEqual({ privateNodes: 0, label: "Виж ролята си", focused: true, snapshots: 0 });

      const rapidButton = await openThemeControl();
      const states = await rapidButton.evaluate(async (element: HTMLButtonElement) => {
        const states = [];
        for (let index = 0; index < 3; index++) {
          element.click();
          const immediateTheme = document.documentElement.dataset.theme;
          await Promise.resolve();
          states.push({
            theme: immediateTheme,
            stored: localStorage.getItem("werewolf-theme"),
            label: element.getAttribute("aria-label"),
            snapshots: window.__themeTransitionCalls,
            transitionMarker: document.documentElement.dataset.vt ?? null,
            privateNodes: document.querySelectorAll("[data-private-dossier]").length,
          });
        }
        return states;
      });
      expect(states).toEqual([theme, next, theme].map((value) => ({
        theme: value,
        stored: value,
        label: value === "light" ? "Смени на тъмна тема" : "Смени на светла тема",
        snapshots: 0,
        transitionMarker: null,
        privateNodes: 0,
      })));
      await closeThemeControl();

      await personal.getByRole("button", { name: "Виж ролята си", exact: true }).click();
      await expect(card).toBeVisible();
      await expect(card).toContainText(name);
      let hiddenAfterToggle;
      if (mobile) {
        // The modal drawer must close before the real role control is reachable.
        const mobileButton = await openThemeControl();
        await mobileButton.click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", next);
        await closeThemeControl();
        await hide.click();
        hiddenAfterToggle = await page.evaluate(() => ({
          theme: document.documentElement.dataset.theme,
          stored: localStorage.getItem("werewolf-theme"),
          privateNodes: document.querySelectorAll("[data-private-dossier], .role-card-result, .play-private-conversation").length,
          snapshots: window.__themeTransitionCalls,
        }));
      } else {
        // Desktop exposes both controls: theme change and hide share one task.
        await expect(button).toBeVisible();
        await expect(hide).toBeVisible();
        hiddenAfterToggle = await page.evaluate(async () => {
          const toggle = document.querySelector<HTMLButtonElement>('.site-chrome button[aria-label^="Смени на"]')!;
          const hide = document.querySelector<HTMLButtonElement>('.play-personal-area button[aria-label="Скрий ролята"]')!;
          toggle.click();
          hide.click();
          await Promise.resolve();
          return {
            theme: document.documentElement.dataset.theme,
            stored: localStorage.getItem("werewolf-theme"),
            privateNodes: document.querySelectorAll("[data-private-dossier], .role-card-result, .play-private-conversation").length,
            snapshots: window.__themeTransitionCalls,
          };
        });
      }
      expect(hiddenAfterToggle).toEqual({ theme: next, stored: next, privateNodes: 0, snapshots: 0 });
      await expect(personal.getByRole("button", { name: "Виж ролята си", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test("public theme with reduced motion changes without document snapshots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepare(page, "dark");
  await page.goto("/faq");
  const button = page.locator(".site-chrome .site-utility-cluster")
    .getByRole("button", { name: /^Смени на (светла|тъмна) тема$/ });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(button).toHaveAccessibleName("Смени на светла тема");
  await button.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(button).toHaveAccessibleName("Смени на тъмна тема");
  expect(await page.evaluate(() => ({ stored: localStorage.getItem("werewolf-theme"), snapshots: window.__themeTransitionCalls })))
    .toEqual({ stored: "light", snapshots: 0 });
});
