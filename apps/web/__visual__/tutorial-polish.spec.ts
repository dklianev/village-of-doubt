import { expect, test, type Page, type TestInfo } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("tutorial-completed", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
}

const SCENES = [
  "Масата се събира.",
  "Очите се затварят.",
  "Кой разказва истината?",
  "Гласът оставя следа.",
  "Още една нощ. Или победа.",
  "Изборът сега е твой.",
];

const GAMES = ["werewolves_classic", "mafia_free", "mafia_sport"] as const;

async function findContentOverflow(page: Page) {
  return page.locator(".tutorial-flipbook").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll<HTMLElement>("h1, h2, p, button, a, select, label, legend")].flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(node).position === "absolute") return [];
      const outside = rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.bottom > bounds.bottom + 1;
      let contentOverflow = node.scrollWidth > node.clientWidth + 1;
      if (node.matches(".btn") && ["hidden", "clip"].includes(getComputedStyle(node).overflowX)) {
        // The clipped hover sheen contributes to scrollWidth, but is not button content.
        const range = document.createRange();
        range.selectNodeContents(node);
        contentOverflow = [...range.getClientRects()].some((content) =>
          content.width > 0 && content.height > 0 &&
          (content.left < rect.left - 1 || content.right > rect.right + 1 ||
            content.top < rect.top - 1 || content.bottom > rect.bottom + 1));
      }
      return outside || contentOverflow ? [node.textContent?.trim()] : [];
    });
  });
}

async function checkLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await findContentOverflow(page)).toEqual([]);
  const navigationOverlap = await page.locator(".tutorial-nav").evaluate((nav) => {
    const children = [...nav.children].map((child) => ({ text: child.textContent?.trim(), rect: child.getBoundingClientRect() }));
    return children.flatMap((first, index) => children.slice(index + 1).flatMap((second) => {
      const overlapX = Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left);
      const overlapY = Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top);
      return overlapX > 1 && overlapY > 1 ? [`${first.text} / ${second.text}`] : [];
    }));
  });
  expect(navigationOverlap).toEqual([]);
  const progressOverlap = await page.locator(".tutorial-progress").evaluate((progress) => {
    const skip = progress.querySelector(".tutorial-skip-link")?.getBoundingClientRect();
    if (!skip?.width || !skip.height) return [];
    return [...progress.querySelectorAll(".tutorial-progress-mobile, .tutorial-progress-mobile > *")].flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      const overlapX = Math.min(rect.right, skip.right) - Math.max(rect.left, skip.left);
      const overlapY = Math.min(rect.bottom, skip.bottom) - Math.max(rect.top, skip.top);
      return overlapX > 1 && overlapY > 1 ? [node.textContent?.trim()] : [];
    });
  });
  expect(progressOverlap).toEqual([]);
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path, fullPage: true, animations: "disabled", style: "nextjs-portal { display: none; }" });
  await info.attach(name, { path, contentType: "image/png" });
}

function monitor(page: Page) {
  const errors: string[] = [];
  const gameTraffic: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("websocket", (socket) => { if (!socket.url().includes("/_next/")) gameTraffic.push(socket.url()); });
  page.on("request", (request) => {
    if (/\/(?:matchmake|api\/(?:rooms|game-token|game))\b/.test(new URL(request.url()).pathname)) gameTraffic.push(request.url());
  });
  return { errors, gameTraffic };
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`tutorial geometry ${theme} ${width}: hover sheen is clipped but real content must fit`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, theme);
      await page.goto("/tutorial?step=1&game=werewolves_classic");
      const next = page.getByRole("button", { name: "Следваща сцена" });
      await expect(next).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      await next.hover();
      await expect.poll(() => next.evaluate((node) => node.scrollWidth > node.clientWidth + 1)).toBe(true);
      await checkLayout(page);
      await next.click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[1]!);
      await checkLayout(page);

      await next.evaluate((node) => {
        node.style.width = "24px";
        node.style.minWidth = "0";
        node.style.padding = "0";
      });
      expect(await findContentOverflow(page)).toContain("Напред");
    });
  }
  for (const { width, game } of [320, 390, 768, 1440].flatMap((width) => GAMES.map((game) => ({ width, game })))) {
    test(`tutorial polish ${theme} ${width} ${game}: six scenes and committed practice`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, theme);
      const { errors, gameTraffic } = monitor(page);
      await page.goto(`/tutorial?step=1&game=${game}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveTitle(/наръчник/i);
      await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toHaveValue(game);

      for (let step = 1; step <= 6; step++) {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[step - 1]!);
        const stage = page.locator(".tutorial-slide-stage");
        await checkLayout(page);

        if (step === 1) {
          await expect(stage.getByRole("img", { name: game === "werewolves_classic" ? "Карта на Гадателка" : "Карта на Комисар" })).toBeVisible();
        }

        if (step === 2) {
          const confirm = page.getByRole("button", { name: "Потвърди проверката" });
          await expect(confirm).toBeDisabled();
          await page.getByRole("radio", { name: "Борис", exact: true }).check();
          await expect(stage.getByRole("status")).not.toContainText("Личен резултат");
          await confirm.click();
          await expect(stage.getByRole("status")).toContainText(game === "werewolves_classic" ? "Борис е нощна заплаха." : "Борис е от Мафията.");
          await expect(confirm).toBeDisabled();
          await expect(stage.locator(".tutorial-portrait")).toHaveCount(3);
        }

        if (step === 3) {
          await page.getByRole("button", { name: "Чуй Анна" }).click();
          await expect(page.locator(".clue-chip-detail")).toContainText("Борис първо подозираше Галя");
          await expect(page.getByRole("button", { name: "Чуй Анна" })).toHaveAttribute("aria-pressed", "true");
          await page.getByRole("button", { name: "Чуй Борис" }).click();
          await page.getByRole("button", { name: "Чуй Анна" }).click();
          await expect(page.getByText("Прочетени: 2 / 3")).toBeVisible();
        }
        if (step === 4) {
          const confirm = page.getByRole("button", { name: "Потвърди гласа" });
          await expect(confirm).toBeDisabled();
          await page.getByRole("radio", { name: "Анна", exact: true }).check();
          await page.getByRole("radio", { name: "Анна", exact: true }).press("ArrowRight");
          await expect(page.getByRole("radio", { name: "Борис", exact: true })).toBeChecked();
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[3]!);
          await expect(page.locator(".tutorial-vote-result")).not.toContainText("е потвърден");
          await confirm.click();
          await expect(page.locator(".tutorial-vote-result")).toContainText("Гласът ти за Борис е потвърден.");
          await expect(confirm).toBeDisabled();
        }

        if (step === 5) {
          await expect(page.getByRole("heading", { name: "Борис напуска масата." })).toBeVisible();
          await expect(page.getByText("Започва нова нощ", { exact: true })).toBeVisible();
          const explanation = stage.locator(".tutorial-slide-callout");
          await expect(explanation).not.toHaveAttribute("open");
          await explanation.locator("summary").focus();
          await explanation.locator("summary").press("Enter");
          await expect(explanation).toHaveAttribute("open", "");
          await expect(page.getByText(/Не гласуваш и не подсказваш на живите/)).toBeVisible();
        }

        await expect.poll(() => stage.locator("img").evaluateAll((images) => images.every((node) => {
          const image = node as HTMLImageElement;
          return image.complete && image.naturalWidth >= image.clientWidth * 3;
        }))).toBe(true);
        await checkLayout(page);
        if (width === 390) {
          expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
        }
        if ([1, 2, 4, 5, 6].includes(step)) {
          await capture(page, testInfo, `tutorial-${theme}-${width}-${game}-scene-${step}`);
        }
        if (step < 6) {
          await page.getByRole("button", { name: "Следваща сцена" }).click();
          await expect(stage).toBeFocused();
        }
      }

      const family = game === "werewolves_classic" ? "werewolf" : "mafia";
      await expect(page.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", game === "mafia_sport" ? "/mafia/create?mode=mafia_sport" : `/${family}/create`);
      await expect(page.getByRole("main").getByRole("link", { name: "Имам код" })).toHaveAttribute("href", `/${family}/join`);
      await expect(page.getByRole("link", { name: /^Ролите / })).toHaveAttribute("href", `/${family}/roles`);
      await expect(page.getByRole("link", { name: "Продължи", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Следваща сцена" })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => localStorage.getItem("tutorial-last-slide"))).toBe("6");
      expect(errors).toEqual([]);
      expect(gameTraffic).toEqual([]);
    });
  }
}

test("tutorial normalizes invalid steps and preserves explicit invitations", async ({ page }) => {
  await prepare(page, "light");
  await page.addInitScript(() => localStorage.setItem("tutorial-last-slide", "3.5"));
  await page.goto("/tutorial");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[0]!);
  await expect(page).toHaveURL(/step=1/);
  await page.goto("/tutorial?step=2.5");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[0]!);
  await expect(page).toHaveURL(/step=1/);
  await page.getByRole("button", { name: "Избери игра", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[5]!);

  const destination = "/mafia/join/ABC123?from=friend#invite";
  await page.goto(`/tutorial?step=6&redirect=${encodeURIComponent(destination)}`);
  await expect(page.getByRole("link", { name: "Продължи към поканата", exact: true })).toHaveAttribute("href", destination);
  await expect(page.getByRole("link", { name: "Към поканата", exact: true })).toHaveAttribute("href", destination);
  await page.goto("/tutorial?step=1&redirect=https://example.invalid");
  await expect(page.getByRole("button", { name: "Избери игра", exact: true })).toBeVisible();
  await expect(page.locator("a.tutorial-skip-link")).toHaveCount(0);
});

test("tutorial direct interactive scenes accept the first click after document load", async ({ page }) => {
  await prepare(page, "dark");
  await page.goto("/tutorial?step=2", { waitUntil: "domcontentloaded" });
  await page.getByRole("radio", { name: "Борис", exact: true }).check();
  await page.getByRole("button", { name: "Потвърди проверката" }).click();
  await expect(page.locator(".tutorial-feedback")).toContainText("Борис е нощна заплаха.");
  await page.goto("/tutorial?step=3", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Чуй Анна" }).click();
  await expect(page.locator(".clue-chip-detail")).toContainText("Борис първо подозираше Галя");
  await page.goto("/tutorial?step=4", { waitUntil: "domcontentloaded" });
  await page.getByRole("radio", { name: "Борис", exact: true }).check();
  await page.getByRole("button", { name: "Потвърди гласа" }).click();
  await expect(page.locator(".tutorial-vote-result")).toContainText("Гласът ти за Борис е потвърден.");
});

test("tutorial deep links survive cached return navigation and browser history", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/tutorial?step=6");
  await expect(page.getByRole("heading", { name: SCENES[5]! })).toBeVisible();
  await page.getByRole("link", { name: "Помощ", exact: true }).click();
  await expect(page).toHaveURL(/\/faq$/);
  const question = page.locator(".faq-hearth-item").filter({ has: page.locator('a[href="/tutorial?step=5"]') }).first();
  await question.getByRole("button").first().click();
  await expect(page).toHaveURL(/\/faq\?q=/);
  const faqUrl = page.url();
  await question.locator('a[href="/tutorial?step=5"]').click();
  await expect(page.getByRole("heading", { name: SCENES[4]! })).toBeVisible();
  await expect(page).toHaveURL(/\/tutorial\?step=5$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("tutorial-last-slide"))).toBe("5");

  await page.goBack();
  await expect(page).toHaveURL(faqUrl);
  await page.goForward();
  await expect(page.getByRole("heading", { name: SCENES[4]! })).toBeVisible();
  await expect(page).toHaveURL(/\/tutorial\?step=5$/);
  await page.getByRole("button", { name: "Следваща сцена" }).click();
  await expect(page.getByRole("heading", { name: SCENES[5]! })).toBeVisible();
  await expect(page).toHaveURL(/\/tutorial\?step=6$/);
});

for (const game of GAMES) {
  test(`tutorial ${game}: reload restores only committed practice and read clues`, async ({ page }) => {
    await prepare(page, "dark");
    const { errors, gameTraffic } = monitor(page);
    await page.goto(`/tutorial?game=${game}&step=2`);
    await page.getByRole("radio", { name: "Борис", exact: true }).check();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Борис", exact: true })).not.toBeChecked();
    await page.getByRole("radio", { name: "Борис", exact: true }).check();
    await page.getByRole("button", { name: "Потвърди проверката" }).click();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Борис", exact: true })).toBeChecked();
    await expect(page.locator(".tutorial-feedback")).toContainText("Личен резултат");
    await page.getByRole("button", { name: "Следваща сцена" }).click();
    await page.getByRole("button", { name: "Чуй Анна" }).click();
    await page.getByRole("button", { name: "Чуй Галя" }).click();
    await page.reload();
    await expect(page.getByText("Прочетени: 2 / 3")).toBeVisible();
    await page.getByRole("button", { name: "Чуй Анна" }).click();
    await expect(page.getByText("Прочетени: 2 / 3")).toBeVisible();
    await page.getByRole("button", { name: "Следваща сцена" }).click();
    await page.getByRole("radio", { name: "Борис", exact: true }).check();
    await page.getByRole("button", { name: "Потвърди гласа" }).click();
    await page.getByRole("radio", { name: "Анна", exact: true }).check();
    await page.reload();
    await expect(page.getByRole("radio", { name: "Борис", exact: true })).toBeChecked();
    await expect(page.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
    await page.getByRole("button", { name: "Следваща сцена" }).click();
    await expect(page.getByRole("heading", { name: "Борис напуска масата." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Борис напуска масата." })).toBeVisible();
    expect(errors).toEqual([]);
    expect(gameTraffic).toEqual([]);
  });
}

test("tutorial mode history isolates practice and preserves the exact invitation", async ({ page }) => {
  await prepare(page, "light");
  const destination = "/mafia/join/ABC123?from=friend&seat=2#invite";
  await page.goto(`/tutorial?game=werewolves_classic&step=4&redirect=${encodeURIComponent(destination)}#lesson`);
  for (const [game, name] of [["werewolves_classic", "Анна"], ["mafia_free", "Борис"], ["mafia_sport", "Галя"]]) {
    await page.getByRole("combobox", { name: "Игра", exact: true }).selectOption(game!);
    await expect(page.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
    await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
    await page.getByRole("radio", { name: name!, exact: true }).check();
    await page.getByRole("button", { name: "Потвърди гласа" }).click();
  }
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toHaveValue("mafia_free");
  await expect(page.getByRole("radio", { name: "Борис", exact: true })).toBeChecked();
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toHaveValue("werewolves_classic");
  await expect(page.getByRole("radio", { name: "Анна", exact: true })).toBeChecked();
  await page.goForward();
  await expect(page.getByRole("radio", { name: "Борис", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "6. Начало" }).click();
  await expect(page.getByRole("link", { name: "Продължи към поканата" })).toHaveAttribute("href", destination);
  expect(new URL(page.url()).hash).toBe("#lesson");
});

test("tutorial skipped exercise has an explicit no-vote result", async ({ page }) => {
  await prepare(page, "dark");
  await page.goto("/tutorial?step=5&game=mafia_sport");
  await expect(page.getByRole("heading", { name: "Още няма потвърден глас." })).toBeVisible();
  await page.getByRole("button", { name: "Към гласуването" }).click();
  await page.getByRole("radio", { name: "Анна", exact: true }).check();
  await page.getByRole("button", { name: "Следваща сцена" }).click();
  await expect(page.getByRole("heading", { name: "Още няма потвърден глас." })).toBeVisible();
  await page.getByRole("button", { name: "Към гласуването" }).click();
  await page.getByRole("radio", { name: "Анна", exact: true }).check();
  await page.getByRole("button", { name: "Потвърди гласа" }).click();
  await page.getByRole("button", { name: "Следваща сцена" }).click();
  await expect(page.getByRole("heading", { name: "Анна напуска масата." })).toBeVisible();
  await expect(page.getByText(/Анна беше от Града/)).toBeVisible();
});

test("tutorial remains usable with unavailable storage", async ({ page }) => {
  await prepare(page, "light");
  await page.addInitScript(() => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("tutorial-")) throw new DOMException("Denied", "SecurityError");
      return originalGet.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("tutorial-")) throw new DOMException("Full", "QuotaExceededError");
      originalSet.call(this, key, value);
    };
  });
  const { errors } = monitor(page);
  await page.goto("/tutorial?step=4");
  await page.getByRole("radio", { name: "Галя", exact: true }).check();
  await page.getByRole("button", { name: "Потвърди гласа" }).click();
  await page.getByRole("button", { name: "Следваща сцена" }).click();
  await expect(page.getByRole("heading", { name: "Галя напуска масата." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("tutorial regression: a fresh Mafia deep link does not seed bare Werewolf progress", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/tutorial?game=mafia_free&step=5");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[4]!);
  await expect.poll(() => page.evaluate(() => ({
    global: localStorage.getItem("tutorial-last-slide"),
    mafia: localStorage.getItem("tutorial-last-slide:mafia_free"),
    werewolf: localStorage.getItem("tutorial-last-slide:werewolves_classic"),
  }))).toEqual({ global: "5", mafia: "5", werewolf: null });

  await page.goto("/tutorial");
  await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toHaveValue("werewolves_classic");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[0]!);
  await expect(page).toHaveURL(/\/tutorial\?step=1$/);
  await expect.poll(() => page.evaluate(() => ({
    global: localStorage.getItem("tutorial-last-slide"),
    mafia: localStorage.getItem("tutorial-last-slide:mafia_free"),
    werewolf: localStorage.getItem("tutorial-last-slide:werewolves_classic"),
  }))).toEqual({ global: "1", mafia: "5", werewolf: "1" });
});

for (const game of ["mafia_free", "mafia_sport"] as const) {
  test(`tutorial regression: contaminated global progress with ${game} does not restore Werewolf`, async ({ page }) => {
    await prepare(page, "light");
    await page.addInitScript((game) => {
      localStorage.setItem("tutorial-last-slide", "5");
      localStorage.setItem(`tutorial-last-slide:${game}`, "5");
    }, game);
    await page.goto("/tutorial");
    await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toHaveValue("werewolves_classic");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[0]!);
    await expect(page).toHaveURL(/\/tutorial\?step=1$/);
    await expect.poll(() => page.evaluate((game) => ({
      global: localStorage.getItem("tutorial-last-slide"),
      mafia: localStorage.getItem(`tutorial-last-slide:${game}`),
      werewolf: localStorage.getItem("tutorial-last-slide:werewolves_classic"),
    }), game)).toEqual({ global: "1", mafia: "5", werewolf: "1" });
  });
}

test("tutorial regression: genuine legacy global-only progress still resumes", async ({ page }) => {
  await prepare(page, "dark");
  await page.addInitScript(() => localStorage.setItem("tutorial-last-slide", "4"));
  await page.goto("/tutorial");
  await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toHaveValue("werewolves_classic");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[3]!);
  await expect(page).toHaveURL(/\/tutorial\?step=4$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("tutorial-last-slide:werewolves_classic"))).toBe("4");
});

test("tutorial regression: delayed hydration disables navigation and preserves the first Mafia selection", async ({ page }) => {
  await prepare(page, "light");
  const { errors } = monitor(page);
  let releaseScripts!: () => void;
  const scriptsReleased = new Promise<void>((resolve) => { releaseScripts = resolve; });
  let delayedScripts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "script") {
      await route.fallback();
      return;
    }
    delayedScripts++;
    await scriptsReleased;
    await route.continue();
  });
  const selector = page.getByRole("combobox", { name: "Игра", exact: true });
  try {
    await page.goto("/tutorial?step=1", { waitUntil: "commit" });
    await expect(selector).toBeVisible();
    await expect.poll(() => delayedScripts).toBeGreaterThan(0);
    await expect(selector).toBeDisabled();
    await expect(page.getByRole("button", { name: "Следваща сцена" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Избери игра", exact: true })).toBeDisabled();
    await expect(page.locator(".tutorial-progress-dot")).toHaveCount(6);
    await expect(page.locator(".tutorial-progress-dot:enabled")).toHaveCount(0);
  } finally {
    releaseScripts();
  }

  await expect(selector).toBeEnabled();
  await expect(page.getByRole("button", { name: "Следваща сцена" })).toBeEnabled();
  await expect(page.locator(".tutorial-progress-dot:enabled")).toHaveCount(6);
  await selector.selectOption("mafia_free");
  await expect(page).toHaveURL((url) => url.searchParams.get("game") === "mafia_free" && url.searchParams.get("step") === "1");
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue("mafia_free");
  await expect(page.locator(".tutorial-flipbook")).toHaveAttribute("data-family", "mafia");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[0]!);
  await expect(page.getByRole("img", { name: "Карта на Комисар" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Карта на Гадателка" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("tutorial-last-slide:mafia_free"))).toBe("1");
  await page.reload();
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue("mafia_free");
  await expect(page).toHaveURL((url) => url.searchParams.get("game") === "mafia_free" && url.searchParams.get("step") === "1");
  await expect(page.getByRole("img", { name: "Карта на Комисар" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  for (const invitation of [false, true]) {
    test(`tutorial regression: 320px 200 percent text ${theme} ${invitation ? "with invitation" : "without invitation"} keeps progress clear of skip`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await prepare(page, theme);
      const destination = "/mafia/join/ABC123?from=friend#invite";
      const params = new URLSearchParams({ game: "mafia_free", step: "1" });
      if (invitation) params.set("redirect", destination);
      await page.goto(`/tutorial?${params}`);
      await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toBeEnabled();
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await page.evaluate(() => document.fonts.ready);
      const skip = invitation
        ? page.getByRole("link", { name: "Към поканата", exact: true })
        : page.getByRole("button", { name: "Избери игра", exact: true });
      const scene = page.getByRole("combobox", { name: "Сцена", exact: true });
      for (const { step, label } of [{ step: 1, label: "Събиране" }, { step: 5, label: "Развръзка" }]) {
        await scene.selectOption(String(step));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[step - 1]!);
        await expect(scene).toHaveValue(String(step));
        await expect(scene.locator("option:checked")).toHaveText(`0${step} / 06 - ${label}`);
        await expect(scene).toBeVisible();
        await expect(skip).toBeVisible();
        if (invitation) await expect(skip).toHaveAttribute("href", destination);
        await checkLayout(page);
        await capture(page, testInfo, `tutorial-progress-${theme}-${invitation ? "invitation" : "no-invitation"}-${step}`);
      }
    });
  }
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile portrait", width: 390, height: 844 },
  { name: "mobile landscape", width: 667, height: 375 },
]) {
  for (const game of GAMES) {
    for (const { step, period } of [{ step: 1, period: "day" }, { step: 2, period: "night" }]) {
      test(`tutorial regression: fresh ${game} ${period} ${viewport.name} requests and preloads only its scene art`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await prepare(page, "light");
        const sceneArt = /\/game-art\/(?:(?:mobile\/)?tutorial-(?:day|night)-scene\.webp|phase-board\/v1\/(?:mafia|werewolves)\/icon-phase-(?:day|night)-\d+\.webp)$/;
        const requests = new Set<string>();
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (sceneArt.test(path)) requests.add(path);
        });
        const expected = game === "werewolves_classic"
          ? `/game-art/${viewport.name === "mobile landscape" ? "mobile/" : ""}tutorial-${period}-scene.webp`
          : `/game-art/phase-board/v1/mafia/icon-phase-${period}-1120.webp`;
        const artResponse = page.waitForResponse((response) => new URL(response.url()).pathname === expected);
        await page.goto(`/tutorial?game=${game}&step=${step}`);
        expect((await artResponse).ok()).toBe(true);
        await expect(page.getByRole("combobox", { name: "Игра", exact: true })).toBeEnabled();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[step - 1]!);
        await expect(page.locator(".tutorial-slide-art")).toHaveCount(1);
        expect(await page.locator(".tutorial-slide-art").evaluate((art) => getComputedStyle(art).backgroundImage)).toContain(expected);
        const preloads = await page.locator('link[rel="preload"][as="image"]').evaluateAll((links, pattern) => links.flatMap((node) => {
          const link = node as HTMLLinkElement;
          const path = new URL(link.href).pathname;
          if (!new RegExp(pattern).test(path)) return [];
          return [{ path, active: !link.media || matchMedia(link.media).matches, priority: link.fetchPriority, type: link.type }];
        }), sceneArt.source);
        expect(preloads.filter((preload) => preload.active)).toEqual([
          { path: expected, active: true, priority: "high", type: "image/webp" },
        ]);
        const allowedPreloads = game === "werewolves_classic"
          ? [`/game-art/tutorial-${period}-scene.webp`, `/game-art/mobile/tutorial-${period}-scene.webp`]
          : [expected];
        expect(preloads.filter((preload) => !allowedPreloads.includes(preload.path))).toEqual([]);
        expect([...requests]).toEqual([expected]);
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`tutorial 200 percent text ${theme} ${width}: readable controls and keyboard focus`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page, theme);
      await page.goto("/tutorial?step=2&game=mafia_sport");
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      const radio = page.getByRole("radio", { name: "Анна", exact: true });
      await expect(radio).toBeEnabled();
      await radio.focus();
      await expect(radio).toBeFocused();
      await page.keyboard.press("Space");
      await expect(radio).toBeChecked();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: "Борис", exact: true })).toBeChecked();
      const focusedLabel = page.locator(".tutorial-seat:has(input:focus-visible)");
      await expect(focusedLabel).toHaveCount(1);
      await expect(focusedLabel).toHaveCSS("outline-style", "solid");
      await capture(page, testInfo, `tutorial-zoom-${theme}-${width}-night-focus`);
      await checkLayout(page);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Потвърди проверката" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator(".tutorial-feedback")).toContainText("Борис е от Мафията.");
      for (const step of [3, 4, 5, 6, 1]) {
        if (width <= 640) {
          await page.getByRole("combobox", { name: "Сцена", exact: true }).selectOption(String(step));
        } else {
          await page.getByRole("button", { name: new RegExp(`^${step}\\.`) }).click();
        }
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENES[step - 1]!);
        await checkLayout(page);
      }
    });
  }
}
