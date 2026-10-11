import { expect, test, type Page } from "playwright/test";

async function prepare(page: Page, width: number, height: number, theme: "light" | "dark") {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`face-down card has the same accent for every faction ${theme}`, async ({ page }) => {
    await prepare(page, 390, 844, theme);
    const accents = [];
    for (const role of ["seer", "werewolf", "jester"]) {
      await page.goto(`/play/VISUAL?visualGame=1&family=werewolves&phase=role_reveal&role=${role}`);
      const dialog = page.getByRole("dialog", { name: "Твоята тайна карта" });
      await expect(dialog).toBeVisible();
      await expect(dialog).not.toHaveAttribute("data-team");
      accents.push(await dialog.evaluate((node) => getComputedStyle(node).getPropertyValue("--ritual-accent")));
    }
    expect(new Set(accents).size).toBe(1);
    await page.getByRole("button", { name: "Обърни картата" }).click();
    await expect(page.getByRole("dialog")).toHaveAttribute("data-team", "neutral");
    await page.getByRole("button", { name: "Запомних" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Виж ролята си", exact: true })).toBeFocused();
    await page.reload();
    await expect(page.locator(".play-personal-toggle")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  for (const size of [{ width: 320, height: 568 }, { width: 640, height: 360 }]) {
    test(`30-player finale reveals a roster taller than five viewports ${theme} ${size.width}`, async ({ page }, testInfo) => {
      await prepare(page, size.width, size.height, theme);
      await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=game_over&players=30&winner=werewolves");
      const roster = page.locator('[aria-labelledby="conclusion-roles"]');
      await expect(roster).toBeAttached();
      await expect(async () => {
        await roster.scrollIntoViewIfNeeded();
        await expect(roster).toHaveAttribute("data-reveal", "revealed");
      }).toPass({ timeout: 10_000 });
      await expect(roster.locator("li")).toHaveCount(30);
      await expect.poll(() => roster.locator("li").first().evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.screenshot({ path: testInfo.outputPath("finale.png") });
    });
  }

  for (const width of [390, 1440]) {
    test(`QR closes to the real opener ${theme} ${width}`, async ({ page }) => {
      await prepare(page, width, 900, theme);
      await page.goto("/play/VISUAL?visualGame=1&family=mafia&phase=lobby&players=10");
      await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
      const trigger = page.getByRole("button", { name: "Покажи QR код за масата" });
      await trigger.click();
      await expect(page.getByRole("dialog", { name: "Покана с QR код" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });
  }
}

for (const feature of [
  { marker: "function RoleRevealGate(", phase: "role_reveal" },
  { marker: "function RoleCard(", phase: "night" },
  { marker: "function SoundscapeHost(", phase: "voting" },
  { marker: "function DeathRevealCinematic(", phase: "day_announcement" },
  { marker: "function InviteTools(", phase: "lobby" },
  { marker: "function InviteQrSheet(", phase: "lobby", qr: true },
]) {
  test(`failed ${feature.marker} keeps the table mounted`, async ({ page }) => {
    await prepare(page, 1440, 900, "dark");
    let blocked = 0;
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes(feature.marker)) {
        blocked++;
        await route.abort("failed");
      } else await route.fulfill({ response });
    });
    await page.goto(`/play/VISUAL?visualGame=1&family=werewolves&phase=${feature.phase}&role=seer&players=12`);
    const stage = page.locator('.play-stage[data-layout-ready="true"]');
    await expect(stage).toBeVisible();
    const originalStage = await stage.elementHandle();
    if (feature.qr) await page.getByRole("button", { name: "Покажи QR код за масата" }).click();
    await expect.poll(() => blocked).toBeGreaterThan(0);
    if (feature.phase === "role_reveal") await page.getByRole("button", { name: "Виж ролята си", exact: true }).click();
    if (feature.marker.includes("RoleCard")) await expect(page.getByRole("article", { name: "Тайна роля: Гадателка" })).toBeVisible();
    if (feature.qr) await expect(page.getByRole("status").filter({ hasText: "QR кодът не се зареди" })).toBeVisible();
    await expect(stage).toBeVisible();
    expect(await originalStage!.evaluate(node => node === document.querySelector(".play-stage"))).toBe(true);
    if (feature.phase === "lobby") await expect(page.getByRole("button", { name: "Копирай покана", exact: true })).toBeEnabled();
  });
}

for (const width of [390, 1440]) {
  test(`failed cue settings stay local and can be dismissed ${width}`, async ({ page }) => {
    await prepare(page, width, 900, "dark");
    let blocked = 0;
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes("function LiveCueSettings(")) {
        blocked++;
        await route.abort("failed");
      } else await route.fulfill({ response });
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=voting&players=12");
    const stage = page.locator('.play-stage[data-layout-ready="true"]');
    await expect(stage).toBeVisible();
    expect(blocked).toBe(0);
    const originalStage = await stage.elementHandle();
    if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
    const trigger = page.locator(".play-console-tools").getByRole("button", { name: /Сигнали/ });
    await trigger.click();
    const failure = page.getByRole("status").filter({ hasText: "Настройките за сигнали не се заредиха." });
    await expect(failure).toBeVisible();
    expect(blocked).toBeGreaterThan(0);
    expect(await originalStage!.evaluate(node => node === document.querySelector(".play-stage"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(failure).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
    await trigger.click();
    await expect(failure).toBeVisible();
    await page.getByRole("button", { name: "Затвори", exact: true }).click();
    await expect(trigger).toBeFocused();
  });

  test(`slow cue settings respect Escape before loading ${width}`, async ({ page }) => {
    await prepare(page, width, 600, "light");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    let requested = false;
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      if ((await response.text()).includes("function LiveCueSettings(")) {
        requested = true;
        await pending;
      }
      await route.fulfill({ response });
    });
    try {
      await page.goto("/play/VISUAL?visualGame=1&family=mafia&phase=voting&players=10");
      await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
      await expect(page.locator(".play-personal-area .role-card")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
      const trigger = page.locator(".play-console-tools").getByRole("button", { name: /Сигнали/ });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      const before = await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight }));
      await trigger.press("Enter");
      await expect.poll(() => requested).toBe(true);
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight }))).toEqual(before);
      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      release();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(page.getByRole("dialog", { name: "Сигнали за фазите" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    } finally {
      release();
    }
  });
}
