import { expect, test } from "playwright/test";

// Keyboard help ships inside the narrator tools chunk, so match the chunk by its code, not its file name.
const KEYBOARD_HELP_MARKER = "function KeyboardShortcutsModal(";

for (const width of [390, 1440]) {
  test(`closing pending reference cancels the deferred opening ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let requested = false;
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes("function PlayReferenceContent(")) {
        requested = true;
        await pending;
      }
      await route.fulfill({ response });
    });
    try {
      await page.goto("/play/VISUAL?visualGame=1&family=mafia&phase=voting&players=10");
      await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
      if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
      const trigger = page.getByRole("button", { name: "Правила", exact: true });
      await trigger.click();
      await expect.poll(() => requested).toBe(true);
      await expect(trigger).toHaveAttribute("aria-busy", "true");
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      release();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(page.getByRole("dialog", { name: "Правила на масата" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    } finally {
      release();
    }
  });

  test(`failed reference leaves the room usable ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    let blocked = 0;
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes("function PlayReferenceContent(")) {
        blocked++;
        await route.abort("failed");
      } else {
        await route.fulfill({ response });
      }
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=voting&players=12");
    const stage = page.locator('.play-stage[data-layout-ready="true"]');
    await expect(stage).toBeVisible();
    expect(blocked).toBe(0);
    const originalStage = await stage.elementHandle();
    if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Правила", exact: true });
    await trigger.click();
    await expect(page.getByText("Правилата не се заредиха. Опитай пак.")).toBeVisible();
    expect(blocked).toBeGreaterThan(0);
    expect(await originalStage!.evaluate((node) => node === document.querySelector(".play-stage"))).toBe(true);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
    await page.locator(".play-console-tools").getByRole("button", { name: /Сигнали/ }).click();
    await expect(page.getByRole("dialog", { name: "Сигнали за фазите" })).toBeVisible();
  });

  test(`failed keyboard help leaves the room mounted and usable ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    let blocked = 0;
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes(KEYBOARD_HELP_MARKER)) {
        blocked++;
        await route.abort("failed");
      } else {
        await route.fulfill({ response });
      }
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=lobby&players=8&viewer=host");
    const stage = page.locator('.play-stage[data-layout-ready="true"]');
    const ready = page.getByTestId("ready-toggle");
    const content = page.locator("#main-content");
    await expect(stage).toBeVisible();
    const originalStage = await stage.elementHandle();
    await content.focus();
    await content.press("?");
    await expect(page.getByText("Помощта не се зареди. Опитай пак.")).toBeVisible();
    expect(blocked).toBeGreaterThan(0);
    expect(await originalStage!.evaluate((node) => node === document.querySelector(".play-stage"))).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(content).toBeFocused();
    await expect(ready).toHaveAttribute("aria-pressed", "true");
    await expect(ready).toBeEnabled();
    // The visual fixture does not simulate server readiness replies.
    const management = page.getByRole("button", { name: "Управление за Искра", exact: true });
    await management.press("Enter");
    await expect(management).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(management).toHaveAttribute("aria-expanded", "false");
  });

  test(`closing pending keyboard help cancels its eventual failure ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let requested = false;
    let blockedUrl = "";
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes(KEYBOARD_HELP_MARKER)) {
        blockedUrl = route.request().url();
        requested = true;
        await pending;
        await route.abort("failed");
      } else {
        await route.fulfill({ response });
      }
    });
    await page.goto("/play/VISUAL?visualGame=1&family=mafia&phase=lobby&players=10&viewer=host");
    const stage = page.locator('.play-stage[data-layout-ready="true"]');
    const content = page.locator("#main-content");
    await expect(stage).toBeVisible();
    await content.focus();
    await content.press("?");
    await expect.poll(() => requested).toBe(true);
    await content.press("Escape");
    const failedRequest = page.waitForEvent("requestfailed", (request) => request.url() === blockedUrl);
    release();
    await failedRequest;
    const ready = page.getByTestId("ready-toggle");
    await ready.focus();
    await expect(ready).toBeEnabled();
    await expect(stage).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Помощта не се зареди. Опитай пак.")).toHaveCount(0);
    await expect(ready).toBeFocused();
  });

  test(`deferred keyboard help preserves the lobby and focus ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=lobby&players=8&viewer=host");
    const ready = page.getByTestId("ready-toggle");
    const content = page.locator("#main-content");
    const dialog = page.getByRole("dialog", { name: "Клавишни команди" });
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await content.focus();
    for (let attempt = 0; attempt < 2; attempt++) {
      await content.press("?");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "затвори", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(content).toBeFocused();
      await expect(ready).toHaveAttribute("aria-pressed", "true");
    }
  });

  test(`reference preserves selection and isolates game shortcuts ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("werewolf-theme", "light");
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=voting&players=12&voteTally=full");
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    const target = page.locator('.play-seat-slot[data-targetable="true"]').last();
    await target.locator("button[data-seat-token]").click();
    await expect(target).toHaveAttribute("data-selected", "true");
    if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
    await page.getByRole("button", { name: "Правила", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Правила на масата" });
    const panel = dialog.getByRole("tabpanel");
    await panel.focus();
    await panel.press("1");
    await expect(target).toHaveAttribute("data-selected", "true");
    await panel.press("?");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(target).toHaveAttribute("data-selected", "true");
  });

  test(`reference and signals preserve a public draft ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=day_discussion&players=8");
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
    await page.getByRole("tab", { name: "Разговор", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Съобщение в дневния разговор" });
    await input.fill("Ще изчакам да чуя останалите.");
    for (const name of [/^Правила$/, /Сигнали/]) {
      await page.locator(".play-console-tools").getByRole("button", { name }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(input).toHaveValue("Ще изчакам да чуя останалите.");
    }
  });
}
