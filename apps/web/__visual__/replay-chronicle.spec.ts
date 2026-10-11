import { expect, test as base, type Page } from "playwright/test";
import { expectDecodedImage } from "./image-readiness";

const test = base.extend<{ runtimeHealth: void }>({
  runtimeHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await use();
    expect(errors, "Replay navigation must not produce runtime or console errors").toEqual([]);
  }, { auto: true }],
});

test.use({ serviceWorkers: "block" });

for (const variant of ["fixture", "mafia"]) {
  test(`actual theme toggle changes ${variant} artwork without moving the chronicle`, async ({ page }) => {
    await prepare(page, "dark", 1440);
    await page.goto(`/history/fixture-game-1/replay?visualReplay=${variant}`);
    await expect(page.getByRole("button", { name: "Смени на светла тема", exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const geometry = () => page.locator("[data-replay-shell] > header, [data-replay-chapter]:not([hidden]) [data-replay-phase]").evaluateAll((elements) => elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }));
    const before = await geometry();
    const art = () => page.locator("[data-replay-shell] > header").evaluate(async (header) => {
      const source = getComputedStyle(header, "::before").backgroundImage.match(/url\("(.*?)"\)/)?.[1];
      if (!source) throw new Error("Replay background is missing");
      const image = new Image();
      image.src = source;
      await image.decode();
      return source;
    });
    const dark = await art();
    await page.getByRole("button", { name: "Смени на светла тема", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const light = await art();
    expect(light).not.toBe(dark);
    expect(light).toContain("light-v1.webp");
    await expect.poll(geometry).toEqual(before);
    await page.getByRole("button", { name: "Смени на тъмна тема", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await art()).toBe(dark);
    await expect.poll(geometry).toEqual(before);
  });
}

async function prepare(page: Page, theme: "light" | "dark", width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

async function expectSelectedChapter(page: Page, chapterId: string, currentTarget = chapterId) {
  const chapters = page.locator("[data-replay-chapter]");
  await expect(page.locator("[data-replay-chapter]:visible")).toHaveCount(1);
  await expect(page.locator(`#${chapterId}`)).toBeVisible();
  for (const chapter of await chapters.all()) {
    if (await chapter.getAttribute("id") === chapterId) {
      await expect(chapter).not.toHaveAttribute("hidden");
    } else {
      await expect(chapter).toHaveAttribute("hidden", "");
      await expect(chapter).toBeHidden();
    }
  }
  const current = page.getByRole("navigation", { name: "Фази в тази част" }).locator("a[aria-current]");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("aria-current", "location");
  await expect(current).toHaveAttribute("href", `#${currentTarget}`);
}

async function expectReachableChapters(page: Page, expectedEvents: number) {
  const timeline = page.getByRole("region", { name: "Хронология на играта" });
  const index = page.getByRole("navigation", { name: "Фази в тази част" });
  const chapters = timeline.locator("[data-replay-chapter]");
  const chapterIds = await chapters.evaluateAll((elements) => elements.map((element) => element.id));
  expect(chapterIds.length).toBeGreaterThan(0);
  expect(chapterIds).toEqual(chapterIds.map((_, position) => `chapter-${position + 1}`));
  await expectSelectedChapter(page, chapterIds.at(-1)!);
  const chapterLinks = index.locator('a[href^="#chapter-"]');
  await expect(chapterLinks).toHaveCount(chapterIds.length);
  expect(await chapterLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))))
    .toEqual(chapterIds.map((id) => `#${id}`));
  const finaleLink = index.locator('a[href^="#phase-"]');
  await expect(finaleLink).toHaveCount(1);
  await expect(index.getByRole("link")).toHaveCount(chapterIds.length + 1);
  const finale = (await finaleLink.getAttribute("href"))!;
  expect(finale).toMatch(/^#phase-\d+$/);
  await expect(page.locator(finale)).toHaveCount(1);

  const ids = await page.locator("[id]").evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(ids).size, "Every chapter and legacy phase target must be unambiguous").toBe(ids.length);
  const events = timeline.locator("[data-replay-event]");
  await expect(events).toHaveCount(expectedEvents);
  const eventOrder = await events.allTextContents();
  const timestamps = await events.locator("time").evaluateAll((elements) => elements.map((element) => element.getAttribute("datetime")));
  expect(timestamps).toEqual([...timestamps].sort());
  const reached: string[] = [];
  for (const chapterId of chapterIds) {
    await index.locator(`a[href="#${chapterId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${chapterId}$`));
    await expectSelectedChapter(page, chapterId);
    const chapter = page.locator(`#${chapterId}`);
    await expect(chapter).toBeFocused();
    await expect(chapter.getByRole("heading", { level: 3 })).toBeVisible();
    for (const event of await chapter.locator("[data-replay-event]").all()) await expect(event).toBeVisible();
    reached.push(...await chapter.locator("[data-replay-event]").allTextContents());
    await expect(events).toHaveText(eventOrder);
    for (const image of await chapter.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expectDecodedImage(image);
    }
  }
  expect(reached, "Every authorized event must be reachable in its original order").toEqual(eventOrder);
  await finaleLink.click();
  await expect(page).toHaveURL(new RegExp(`${finale}$`));
  await expectSelectedChapter(page, chapterIds.at(-1)!, finale.slice(1));
  await expect(page.locator(finale)).toBeVisible();
  await expect(page.locator(finale)).toBeFocused();
  await expect(events).toHaveText(eventOrder);
  await expect(page.getByRole("tablist")).toHaveCount(0);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    for (const fixture of [
      { variant: "fixture", heading: "Селото оцеля.", role: "Гадателка" },
      { variant: "mafia", heading: "Градът оцеля.", role: "Комисар" },
    ]) {
      test(`${fixture.variant} chronicle keeps its roster and all authorized events reachable ${theme} ${width}`, async ({ page }) => {
        await prepare(page, theme, width);
        await page.goto(`/history/fixture-game-1/replay?visualReplay=${fixture.variant}`);
        await expect(page.getByRole("heading", { level: 1, name: fixture.heading, exact: true })).toBeVisible();
        const roster = page.getByRole("complementary", { name: "Участници в записа" });
        await expect(roster.getByText("Анна", { exact: true })).toBeVisible();
        await expect(roster.getByText(fixture.role, { exact: true })).toBeVisible();
        await expect(roster.getByText("Борис", { exact: true })).toBeVisible();
        await expect(roster.getByText("Рада", { exact: true })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await expectReachableChapters(page, 8);

        const portraits = roster.locator("img");
        expect(await portraits.count()).toBeGreaterThan(0);
        for (const portrait of await portraits.all()) {
          await portrait.scrollIntoViewIfNeeded();
          await expectDecodedImage(portrait);
        }
      });
    }
  }
}

for (const variant of ["fixture", "mafia"]) {
  for (const width of [390, 1440]) {
    test(`${variant} chapters support keyboard, history, reload and legacy phase anchors ${width}`, async ({ page }) => {
      await prepare(page, "light", width);
      const href = `/history/fixture-game-1/replay?visualReplay=${variant}`;
      await page.goto(href);
      const index = page.getByRole("navigation", { name: "Фази в тази част" });
      await expect(index).toBeVisible();
      const defaultChapter = (await page.locator("[data-replay-chapter]").last().getAttribute("id"))!;
      await expectSelectedChapter(page, defaultChapter);
      const events = page.locator("[data-replay-event]");
      const eventOrder = await events.allTextContents();
      const first = index.locator('a[href="#chapter-1"]');
      const second = index.locator('a[href="#chapter-2"]');

      await first.click();
      await expect(page).toHaveURL(`${href}#chapter-1`);
      await expectSelectedChapter(page, "chapter-1");
      await expect(page.locator("#chapter-1")).toBeFocused();
      await first.focus();
      await page.keyboard.press("Tab");
      await expect(second).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(`${href}#chapter-2`);
      await expectSelectedChapter(page, "chapter-2");
      await expect(page.locator("#chapter-2")).toBeFocused();
      await page.goBack();
      await expect(page).toHaveURL(`${href}#chapter-1`);
      await expectSelectedChapter(page, "chapter-1");
      await page.goBack();
      await expect(page).toHaveURL(href);
      await expectSelectedChapter(page, defaultChapter);
      await page.goForward();
      await expectSelectedChapter(page, "chapter-1");
      await page.goForward();
      await expect(page).toHaveURL(`${href}#chapter-2`);
      await expectSelectedChapter(page, "chapter-2");
      await page.reload();
      await expectSelectedChapter(page, "chapter-2");
      await expect(events).toHaveText(eventOrder);

      await page.goto(`${href}#phase-2`);
      await expect(page.locator("#phase-2")).toBeVisible();
      const legacyChapter = await page.locator("#phase-2").evaluate((phase) => phase.closest("[data-replay-chapter]")!.id);
      await expectSelectedChapter(page, legacyChapter);
      await expect(page).toHaveURL(`${href}#phase-2`);
      await page.reload();
      await expect(page).toHaveURL(`${href}#phase-2`);
      await expectSelectedChapter(page, legacyChapter);
      await expect(page.locator("#phase-2")).toBeVisible();
      await expect(events).toHaveText(eventOrder);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`long chapters start at their heading when selected from the sticky index ${theme}`, async ({ page }) => {
    await prepare(page, theme, 1440);
    await page.goto("/history/fixture-game-1/replay?visualReplay=long");
    await expectSelectedChapter(page, "chapter-1");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 1400));
    const index = page.getByRole("navigation", { name: "Фази в тази част" });
    await expect(index.getByRole("link", { name: "Ден 2", exact: true })).toBeInViewport();
    await expect(page.locator("#chapter-1 h3")).not.toBeInViewport();

    await index.getByRole("link", { name: "Ден 2", exact: true }).click();

    await expectSelectedChapter(page, "chapter-2");
    await expect(page.locator("#chapter-2")).toBeFocused();
    await expect(page.locator("#chapter-2 h3")).toBeInViewport({ ratio: 1 });
    await expect(page.locator("#chapter-2 [data-replay-event]").first()).toBeInViewport({ ratio: 1 });
    expect(await page.locator("#chapter-2").evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(80);
    await index.getByRole("link", { name: "Ден 3", exact: true }).click();
    await page.goBack();
    await expectSelectedChapter(page, "chapter-2");
    await expect(page.locator("#chapter-2 h3")).toBeInViewport({ ratio: 1 });
    await page.goForward();
    await expectSelectedChapter(page, "chapter-3");
    await expect(page.locator("#chapter-3 h3")).toBeInViewport({ ratio: 1 });
  });

  for (const target of ["chapter-2", "phase-2"]) {
    test(`direct hidden ${target} scrolls into the mobile viewport on load and reload ${theme}`, async ({ page }) => {
      await prepare(page, theme, 390);
      await page.setViewportSize({ width: 390, height: 640 });
      await page.goto(`/history/fixture-game-1/replay?visualReplay=demo#${target}`);
      const destination = page.locator(`#${target}`);
      await expectSelectedChapter(page, "chapter-2");
      await expect(destination).toBeFocused();
      await expect(destination).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await page.reload();
      await expectSelectedChapter(page, "chapter-2");
      await expect(destination).toBeFocused();
      await expect(destination).toBeInViewport({ ratio: 1 });
      expect(await destination.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(80);
    });
  }

  test(`a terminal cursor page opens at its first remaining chapter ${theme}`, async ({ page }) => {
    await prepare(page, theme, 390);
    // The long fixture has 20 events per round; this cursor leaves the end of Day 50 and Day 51.
    const startedAt = Date.parse("2026-05-14T20:30:00.000Z");
    const after = `${new Date(startedAt + 995_000).toISOString()}~00000000-0000-4000-8000-000000000996`;
    await page.goto(`/history/fixture-game-1/replay?visualReplay=long&after=${encodeURIComponent(after)}#chronicle`);

    await expectSelectedChapter(page, "chapter-1");
    await expect(page.getByRole("heading", { name: "Ден 50", exact: true })).toBeVisible();
    const first = page.locator("[data-replay-chapter]:visible [data-replay-event]").first();
    await expect(first.locator("time")).toHaveAttribute("datetime", new Date(startedAt + 996_000).toISOString());
    await expect(page.getByRole("link", { name: "Следващи събития" })).toHaveCount(0);
    await expect(page.locator("#chapter-2")).toBeHidden();
    await page.getByRole("navigation", { name: "Фази в тази част" }).getByRole("link", { name: "Ден 51", exact: true }).click();
    await expectSelectedChapter(page, "chapter-2");
    await expect(page.locator("[data-replay-event]")).toHaveCount(9);
  });

  test(`mobile chapter selection centers its nav link without a vertical jump ${theme}`, async ({ page }) => {
    await prepare(page, theme, 390);
    const href = "/history/fixture-game-1/replay?visualReplay=demo";
    await page.goto(`${href}#chapter-1`);
    await expectSelectedChapter(page, "chapter-1");
    await page.evaluate(() => document.fonts.ready);
    const index = page.getByRole("navigation", { name: "Фази в тази част" });
    const strip = index.getByRole("list");
    const link = index.locator('a[href="#chapter-3"]');
    await index.scrollIntoViewIfNeeded();
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBe(0);
    await expect(link).toBeInViewport({ ratio: 1 });
    const scrollY = await page.evaluate(() => window.scrollY);

    await link.click();
    await expect(page).toHaveURL(`${href}#chapter-3`);
    await expectSelectedChapter(page, "chapter-3");
    await expect(page.locator("#chapter-3")).toBeFocused();
    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => link.evaluate((element) => {
      const linkBox = element.getBoundingClientRect();
      const strip = element.closest("ol")!;
      const stripBox = strip.getBoundingClientRect();
      return Math.abs(linkBox.left + linkBox.width / 2 - (stripBox.left + strip.clientWidth / 2));
    })).toBeLessThanOrEqual(2);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  test(`public replay does not infer roster portraits from a revealed death ${theme}`, async ({ page }) => {
    await prepare(page, theme, 390);
    const roleRequests: string[] = [];
    page.on("request", (request) => {
      const url = decodeURIComponent(request.url());
      if (/\/game-art\/(?:[\w-]+\/)*role-[\w-]+/.test(url)) roleRequests.push(url);
    });
    await page.goto("/history/fixture-game-1/replay?visualReplay=public");
    await expect(page.getByText("Публичен запис", { exact: true })).toBeVisible();
    const roster = page.getByRole("complementary", { name: "Участници в записа" });
    await expect(roster.getByText("Ролята не е показана", { exact: true })).toHaveCount(3);
    const timeline = page.getByRole("region", { name: "Хронология на играта" });
    await expect(timeline).toContainText("Разкрита роля: Върколак.");
    await expect(timeline.getByRole("heading", { name: "Нощно действие", exact: true, includeHidden: true })).toHaveCount(0);
    await expect(timeline.getByRole("heading", { name: "Преброяване", exact: true, includeHidden: true })).toHaveCount(0);
    await expect(roster).not.toContainText(/Гадателка|Върколак/);
    const rosterAssets = await roster.evaluate((element) => [...element.querySelectorAll("*")].flatMap((node) => [
      node.getAttribute("src"), node.getAttribute("srcset"), node.getAttribute("style"),
      getComputedStyle(node).backgroundImage, getComputedStyle(node, "::before").backgroundImage,
      getComputedStyle(node, "::after").backgroundImage,
    ]).join(" "));
    expect(decodeURIComponent(rosterAssets)).not.toMatch(/\/game-art\/(?:[\w-]+\/)*role-[\w-]+/);
    await expect(roster.locator("[data-survival]")).toHaveCount(0);
    await expectReachableChapters(page, 5);
    for (const image of await page.locator("main img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expectDecodedImage(image);
    }
    // The public death event may request its revealed role, but never a hidden role.
    for (const request of roleRequests) expect(request).toMatch(/\/role-werewolf\./);
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`public demo uses eight persisted avatars and survival states without hidden roles ${theme} ${width}`, async ({ page }) => {
      await prepare(page, theme, width);
      const roleRequests: string[] = [];
      page.on("request", (request) => {
        const url = decodeURIComponent(request.url());
        if (/\/game-art\/(?:[\w-]+\/)*role-[\w-]+/.test(url)) roleRequests.push(url);
      });
      await page.goto("/history/fixture-game-1/replay?visualReplay=demo");
      await expect(page.getByText("Публичен запис", { exact: true })).toBeVisible();
      const roster = page.getByRole("complementary", { name: "Участници в записа" });
      const participants = [
        { name: "Анна", avatar: "portrait-f01", status: "alive" },
        { name: "Рада", avatar: "portrait-f02", status: "alive" },
        { name: "Борис", avatar: "portrait-m02", status: "dead" },
        { name: "Елена", avatar: "portrait-f03", status: "dead" },
        { name: "Иван", avatar: "portrait-m01", status: "alive" },
        { name: "Георги", avatar: "portrait-m03", status: "alive" },
        { name: "Мира", avatar: "portrait-f04", status: "dead" },
        { name: "Тодор", avatar: "portrait-m04", status: "dead" },
      ];
      await expect(roster.locator("li")).toHaveCount(8);
      await expect(roster.getByText("8 участници", { exact: true })).toBeVisible();
      await expect(roster.locator("details")).not.toHaveAttribute("open");
      await expect(roster.getByText("Иван", { exact: true })).toBeHidden();
      await roster.locator("summary").click();
      await expect(roster.locator("details")).toHaveAttribute("open", "");
      for (const participant of participants) {
        const row = roster.locator("li").filter({ has: page.getByText(participant.name, { exact: true }) });
        await expect(row).toBeVisible();
        await expect(row.locator("[data-survival]")).toHaveAttribute("data-survival", participant.status);
        await expect(row.locator("[data-survival]")).toHaveText(participant.status === "alive" ? "Оцеля" : "Елиминиран");
        await expect(row.locator("img")).toHaveAttribute("src", `/game-art/avatars/${participant.avatar}.webp`);
        await row.locator("img").scrollIntoViewIfNeeded();
        await expectDecodedImage(row.locator("img"));
      }
      await expect(roster).not.toContainText(/Гадателка|Върколак|Обикновен селянин|Комисар|Мафиот/);
      await expect(roster.locator("li small")).toHaveCount(0);
      const assets = await roster.locator("[src], [srcset], [style], [alt], [title], [aria-label]").evaluateAll((elements) =>
        elements.flatMap((element) => ["src", "srcset", "style", "alt", "title", "aria-label"].map((name) => element.getAttribute(name))).join(" "),
      );
      expect(decodeURIComponent(assets)).not.toMatch(/role-[\w-]+|card-back-secret|\bseer\b|\bmafioso\b|\bcommissioner\b/);
      const timeline = page.getByRole("region", { name: "Хронология на играта" });
      await expect(timeline.getByRole("heading", { name: "Нощно действие", exact: true, includeHidden: true })).toHaveCount(0);
      await expect(timeline.getByRole("heading", { name: "Преброяване", exact: true, includeHidden: true })).toHaveCount(0);
      await expectReachableChapters(page, 8);
      await expect(timeline).toContainText("Разкрита роля: Върколак.");
      // Public status survives chapter changes even for deaths absent from the timeline.
      await expect(roster.locator('[data-survival="alive"]')).toHaveCount(4);
      await expect(roster.locator('[data-survival="dead"]')).toHaveCount(4);
      for (const request of roleRequests) expect(request).toMatch(/\/role-werewolf\./);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const screenshot = test.info().outputPath("public-demo-roster.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      await test.info().attach("public-demo-roster", { path: screenshot, contentType: "image/png" });
    });
  }
}

test("unknown replay codes stay out of text, accessible labels, and artwork URLs", async ({ page }) => {
  await prepare(page, "light", 390);
  await page.goto("/history/fixture-game-unknown/replay?visualReplay=unknown-codes");
  const main = page.getByRole("main");
  await expect(main).toContainText("Неизвестна фаза");
  await expect(main).toContainText("Друго събитие");
  await expect(main).toContainText("Неизвестна роля");
  await expect(main).not.toContainText(/future_(winner|phase|event|visibility|role|payload)|fixture-game-unknown/);
  const attributes = await main.locator("[src], [srcset], [style], [alt], [title], [aria-label]").evaluateAll((elements) =>
    elements.flatMap((element) => ["src", "srcset", "style", "alt", "title", "aria-label"].map((name) => element.getAttribute(name))).join(" "),
  );
  expect(decodeURIComponent(attributes)).not.toMatch(/future_(winner|phase|event|visibility|role|payload)/);
});

for (const { width, theme } of [{ width: 390, theme: "light" }, { width: 1440, theme: "dark" }] as const) {
  test(`archive styles do not alter the replay after client navigation and browser history ${theme} ${width}`, async ({ page }) => {
    await prepare(page, theme, width);
    await page.goto("/history?visualHistory=fixture");
    const archiveLink = page.getByRole("link", { name: /^Отвори дело №/ }).first();
    const href = await archiveLink.getAttribute("href");
    expect(href).toMatch(/\/replay\?visualReplay=fixture$/);
    await page.goto(href!);
    const heading = page.getByRole("heading", { level: 1, name: "Селото оцеля.", exact: true });
    await expect(heading).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const layout = () => page.locator("[data-replay-shell]").evaluate((shell) => {
      const selectors = ["h1", "[data-replay-chapter]:not([hidden]) [data-replay-phase]", "[data-replay-chapter]:not([hidden]) [data-replay-event]", '[aria-label="Участници в записа"]'];
      return selectors.map((selector) => {
        const element = shell.querySelector(selector)!;
        const style = getComputedStyle(element);
        return {
          width: element.getBoundingClientRect().width,
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          padding: style.padding,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          backgroundColor: style.backgroundColor,
        };
      });
    });
    const directLayout = await layout();
    await expect(page.locator(".replay-shell, .replay-summary, .replay-phase-group, .replay-event-v2")).toHaveCount(0);
    await page.goto("/history?visualHistory=fixture");
    await archiveLink.click();
    await expect(heading).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(layout).toEqual(directLayout);
    await page.goBack();
    await expect(archiveLink).toBeVisible();
    await page.goForward();
    await expect(heading).toBeVisible();
    await expect.poll(layout).toEqual(directLayout);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
