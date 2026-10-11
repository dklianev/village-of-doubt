import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "playwright/test";
import sharp from "sharp";

test.use({ serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" } });

type Friend = { id: string; name: string; note: string };
type Theme = "light" | "dark";
const storageKey = "werewolf-mafia-friends-v1";
const evidenceDirectory = process.env.FRIENDS_QA_DIR ?? "test-results/friends-qa";
const entries: Friend[] = [
  { id: "guestbook-fixture-mila", name: "Мила", note: "Синтетична бележка: разказвач" },
  { id: "guestbook-fixture-boris", name: "Борис", note: "Синтетична бележка: петък вечер" },
  { id: "guestbook-fixture-rada", name: "Рада", note: "Синтетична бележка: Мафия" },
];
const longEntry: Friend = {
  id: "guestbook-fixture-long",
  name: "Я".repeat(60),
  note: "Д".repeat(240),
};
const observations = new WeakMap<Page, { errors: string[]; requests: string[] }>();

test.beforeEach(async ({ page }) => {
  const state = { errors: [] as string[], requests: [] as string[] };
  observations.set(page, state);
  page.on("pageerror", (error) => state.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") state.errors.push(message.text());
  });
  page.on("request", (request) => state.requests.push(`${request.url()}\n${request.postData() ?? ""}`));
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
});

test.afterEach(async ({ page }, info) => {
  const observed = observations.get(page)!;
  await info.attach("runtime-errors", { body: JSON.stringify(observed.errors), contentType: "application/json" });
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    await capture(page, info, `guestbook-failed-${info.titlePath.slice(1).join("-").replace(/[^a-zA-Z0-9-]+/g, "-")}`);
  }
  expect(observed.errors, "No page exceptions or browser console errors").toEqual([]);
  for (const friend of [...entries, longEntry]) {
    for (const value of [friend.id, friend.note]) {
      expect(observed.requests.some((request) => request.includes(value) || request.includes(encodeURIComponent(value))),
        "Synthetic private records must not leave local storage").toBe(false);
    }
  }
});

async function ready(page: Page, theme: Theme) {
  await expect(page).toHaveURL(/\/friends\?visualAuth=1$/);
  await expect(page).toHaveTitle(/Познати на масата/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("main > div[aria-busy]")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("heading", { name: "Познати на масата", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Твоята компания", exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("nextjs-portal").locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
}

async function openGuestbook(page: Page, theme: Theme, friends: Friend[] = []) {
  // Playwright's per-test context owns all storage; reloads must not overwrite CRUD results.
  await page.addInitScript(({ theme, key, friends }) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(friends));
  }, { theme, key: storageKey, friends });
  await page.goto("/friends?visualAuth=1", { waitUntil: "domcontentloaded" });
  await ready(page, theme);
}

async function replaceFixture(page: Page, theme: Theme, friends: Friend[]) {
  await page.evaluate(({ key, friends }) => localStorage.setItem(key, JSON.stringify(friends)), { key: storageKey, friends });
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page, theme);
}

async function storedFriends(page: Page): Promise<Friend[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
}

async function clipboardText(page: Page) {
  // The native Windows clipboard uses CRLF even when writeText receives LF.
  return (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
}

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, "Expected a rendered element with measurable bounds").not.toBeNull();
  return box!;
}

async function noOverflow(page: Page) {
  const viewport = page.viewportSize()!;
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)))
    .toBeLessThanOrEqual(viewport.width);
  const clipped = await page.locator("main h1, main h2, main h3, main li p, main li button, main li input").evaluateAll((elements) =>
    elements.filter((element) => {
      if (!element.getClientRects().length) return false;
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1;
    }).map((element) => ({ tag: element.tagName, text: element.textContent?.slice(0, 80) })),
  );
  expect(clipped, "Text and row controls must fit without clipping").toEqual([]);
}

async function assertLayout(page: Page) {
  const { width } = page.viewportSize()!;
  const hero = await bounds(page.locator("main > header"));
  const list = await bounds(page.getByRole("region", { name: "Твоята компания", exact: true }));
  const invitation = await bounds(page.getByRole("region", { name: "Покана", exact: true }));
  const expectedHeight = width <= 820 ? 286 : 328;
  expect.soft(hero.height).toBeGreaterThanOrEqual(expectedHeight);
  expect.soft(hero.height).toBeLessThanOrEqual(expectedHeight + 1);
  expect(list.y).toBeGreaterThanOrEqual(hero.y + hero.height);
  expect(list.y).toBeLessThanOrEqual(hero.y + hero.height + 64);
  expect(list.x).toBeGreaterThanOrEqual(16);
  if (width > 820) {
    expect(invitation.x).toBeGreaterThan(list.x + list.width);
    expect(invitation.y - list.y).toBe(10);
  } else {
    expect(invitation.y).toBeGreaterThanOrEqual(list.y + list.height);
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("form")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Име", exact: true })).toHaveCount(0);
  await expect(page.getByText("Само в този браузър", { exact: true })).toBeVisible();
  const missingIcons = await page.locator("main button").evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length && !element.querySelector('svg[aria-hidden="true"]'))
    .map((element) => element.getAttribute("aria-label") ?? element.textContent));
  expect(missingIcons, "Server-owned icon slots must still render on every visible command").toEqual([]);
  const typography = await page.locator("main h1, main h2, main li h3, main li p").evaluateAll((elements) =>
    elements.filter((element) => element.getClientRects().length).map((element) => {
      const style = getComputedStyle(element);
      return { tag: element.tagName, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight), color: style.color, opacity: style.opacity };
    }),
  );
  expect.soft(typography.find((item) => item.tag === "H1")!.size).toBe(width <= 360 ? 36 : width <= 820 ? 40 : 60);
  for (const item of typography) {
    expect(item.size).toBeGreaterThanOrEqual(item.tag === "P" ? 12 : 14);
    expect(item.lineHeight).toBeGreaterThanOrEqual(item.size);
    expect(item.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(Number(item.opacity)).toBeGreaterThanOrEqual(0.75);
  }
  await noOverflow(page);
  return { hero, list, invitation, typography };
}

async function capture(page: Page, info: TestInfo, name: string, fullPage = true) {
  await mkdir(evidenceDirectory, { recursive: true });
  const browser = info.project.use.browserName ?? "chromium";
  const path = join(evidenceDirectory, `${name}${browser === "chromium" ? "" : `-${browser}`}.png`);
  await page.screenshot({ path, fullPage, animations: "disabled", caret: "initial", style: "nextjs-portal { visibility: hidden; } input, textarea { caret-color: transparent !important; }" });
  await info.attach(name, { path, contentType: "image/png" });
}

async function accessible(page: Page, selector = "main") {
  expect((await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
}

async function visibleScene(page: Page) {
  const hero = await bounds(page.locator("main > header"));
  const clip = { x: 0, y: hero.y, width: page.viewportSize()!.width, height: Math.min(hero.height, 200) };
  const visible = await page.screenshot({ clip, animations: "disabled", style: "nextjs-portal { visibility: hidden; }" });
  const hidden = await page.screenshot({ clip, animations: "disabled", style: "nextjs-portal, body::before { visibility: hidden !important; }" });
  const painted = await sharp(visible).ensureAlpha().raw().toBuffer();
  const control = await sharp(hidden).ensureAlpha().raw().toBuffer();
  expect(painted.length).toBe(control.length);
  let changed = 0;
  for (let offset = 0; offset < painted.length; offset += 4) {
    const difference = Math.abs(painted[offset]! - control[offset]!)
      + Math.abs(painted[offset + 1]! - control[offset + 1]!)
      + Math.abs(painted[offset + 2]! - control[offset + 2]!);
    if (difference > 12) changed += 1;
  }
  const paintedRatio = changed / (painted.length / 4);
  expect(paintedRatio, "Decoded scene art must actually paint above the body background").toBeGreaterThan(0.05);
  return paintedRatio;
}

async function backgroundGeometry(page: Page) {
  return page.evaluate(() => ({
    scrollX, scrollY, width: innerWidth, layoutWidth: document.documentElement.getBoundingClientRect().width,
    listLeft: document.getElementById("friend-list-title")!.getBoundingClientRect().left,
    mainWidth: document.querySelector("main")!.getBoundingClientRect().width,
    navbarWidth: document.querySelector(".site-chrome")!.getBoundingClientRect().width,
  }));
}

async function doubleGuestbookText(page: Page) {
  await page.locator("main, main *").evaluateAll((elements) => {
    const sizes = elements.filter((element): element is HTMLElement => element instanceof HTMLElement).map((element) => {
      const style = getComputedStyle(element);
      return { element, size: parseFloat(style.fontSize), lineHeight: parseFloat(style.lineHeight) };
    });
    for (const { element, size, lineHeight } of sizes) {
      element.style.setProperty("font-size", `${size * 2}px`, "important");
      if (Number.isFinite(lineHeight)) element.style.setProperty("line-height", `${lineHeight * 2}px`, "important");
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test.describe(`guestbook ${theme} ${width}`, () => {
      test.use({ viewport: { width, height: width < 768 ? 844 : 960 } });

      test("empty, populated and maximum-length rows stay readable", async ({ page }, info) => {
        test.setTimeout(90_000);
        await openGuestbook(page, theme);
        await expect(page.getByRole("heading", { name: "Още няма вписани имена", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Добави име", exact: true })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Копирай поканата", exact: true })).toBeDisabled();
        const geometry = await assertLayout(page);
        const art = await page.locator("body").evaluate(async (element) => {
          const urls = Array.from(getComputedStyle(element, "::before").backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g), (match) => match[1]!);
          return Promise.all(urls.map(async (url) => {
            const image = new Image();
            image.src = url;
            await image.decode();
            return { url, width: image.naturalWidth, height: image.naturalHeight };
          }));
        });
        expect(art.length, "The guestbook scene must render its bitmap art").toBeGreaterThan(0);
        for (const image of art) {
          expect(image.width).toBeGreaterThanOrEqual(320);
          expect(image.height).toBeGreaterThan(0);
        }
        const paintedRatio = await visibleScene(page);
        await info.attach("layout-and-art", { body: JSON.stringify({ geometry, art, paintedRatio }, null, 2), contentType: "application/json" });
        await capture(page, info, `guestbook-empty-${theme}-${width}`);
        await accessible(page);

        await replaceFixture(page, theme, entries);
        const list = page.getByRole("region", { name: "Твоята компания", exact: true });
        await expect(list.getByRole("listitem")).toHaveCount(entries.length);
        for (const friend of entries) {
          const row = list.getByRole("listitem").filter({ has: page.getByRole("heading", { name: friend.name, exact: true }) });
          await expect(row.getByRole("checkbox", { name: `Избери ${friend.name}`, exact: true })).toBeVisible();
          await expect(row.locator(':scope > span[aria-hidden="true"]')).toHaveText(friend.name[0]!);
          await expect(row.getByText(friend.note, { exact: true })).toBeVisible();
          await expect(row.getByRole("button", { name: `Редактирай ${friend.name}`, exact: true })).toBeVisible();
          await expect(row.getByRole("button", { name: `Премахни ${friend.name}`, exact: true })).toBeVisible();
        }
        const firstRow = list.getByRole("listitem").first();
        const before = await bounds(firstRow);
        await firstRow.getByRole("button", { name: "Редактирай Мила", exact: true }).hover();
        await firstRow.getByRole("checkbox").check();
        const after = await bounds(firstRow);
        expect(after.width).toBe(before.width);
        expect(after.height).toBe(before.height);
        await assertLayout(page);
        await page.mouse.move(0, 0);
        await page.evaluate(() => window.scrollTo(0, 0));
        await capture(page, info, `guestbook-populated-${theme}-${width}`);
        await accessible(page);

        await replaceFixture(page, theme, [longEntry, ...entries]);
        await expect(list.getByRole("heading", { name: longEntry.name, exact: true })).toBeVisible();
        await expect(list.getByText(longEntry.note, { exact: true })).toBeVisible();
        await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
        expect(await storedFriends(page)).toEqual([longEntry, ...entries]);
        await assertLayout(page);
        await capture(page, info, `guestbook-long-${theme}-${width}`);
        await accessible(page);
      });
    });
  }

  for (const width of [320, 1440]) {
    test.describe(`guestbook interactions ${theme} ${width}`, () => {
      test.use({ viewport: { width, height: width === 320 ? 844 : 960 } });

      test("dialog CRUD preserves escaped drafts and restores trigger focus", async ({ page }, info) => {
        await openGuestbook(page, theme, entries);
        const add = page.getByRole("region", { name: "Твоята компания", exact: true }).getByRole("button", { name: "Добави име", exact: true });
        await expect(page.getByRole("form")).toHaveCount(0);
        await add.scrollIntoViewIfNeeded();
        const beforeDialog = await backgroundGeometry(page);
        await add.click();
        const dialog = page.getByRole("dialog", { name: "Ново име", exact: true });
        const name = dialog.getByRole("textbox", { name: "Име", exact: true });
        const note = dialog.getByRole("textbox", { name: /Бележка/ });
        await expect(dialog.getByRole("heading", { name: "Ново име", exact: true })).toBeVisible();
        await expect(name).toBeFocused();
        await page.locator('section[aria-labelledby="friend-list-title"] button[aria-label="Добави име"]').evaluate((element: HTMLButtonElement) => element.focus());
        await expect(name, "The background trigger is inert while the native modal is open").toBeFocused();
        expect(await backgroundGeometry(page), "Opening a native dialog must not shift the underlying viewport").toEqual(beforeDialog);
        await page.mouse.move(2, 120);
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(150);
        expect(await backgroundGeometry(page), "Wheel input on the backdrop must not scroll the page or move the navbar").toEqual(beforeDialog);
        expect(await page.locator("html").evaluate((element) => getComputedStyle(element).overflow)).toBe("hidden");
        await name.fill("Анна Тестова");
        await note.fill("Само локална синтетична чернова");
        await noOverflow(page);
        const dialogBox = await bounds(dialog);
        expect(dialogBox.x).toBeGreaterThanOrEqual(0);
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(width);
        expect(dialogBox.y).toBeGreaterThanOrEqual(0);
        expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        await capture(page, info, `guestbook-new-dialog-${theme}-${width}`, false);
        await accessible(page, "dialog[open]");
        await dialog.getByRole("button", { name: "Затвори", exact: true }).focus();
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("button", { name: "Добави име", exact: true })).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(dialog.getByRole("button", { name: "Затвори", exact: true })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(add).toBeFocused();
        expect(await backgroundGeometry(page), "Escape must restore the unshifted page").toEqual(beforeDialog);
        expect(await page.locator("html").evaluate((element) => getComputedStyle(element).overflow)).not.toBe("hidden");
        expect(await storedFriends(page)).toEqual(entries);
        await add.click();
        await expect(name).toHaveValue("Анна Тестова");
        await expect(note).toHaveValue("Само локална синтетична чернова");
        await name.press("Enter");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(add).toBeFocused();
        await expect(page.getByRole("heading", { name: "Анна Тестова", exact: true })).toBeVisible();
        const added = (await storedFriends(page)).find((friend) => friend.name === "Анна Тестова")!;
        expect(added).toEqual({ id: expect.any(String), name: "Анна Тестова", note: "Само локална синтетична чернова" });

        const edit = page.getByRole("button", { name: "Редактирай Анна Тестова", exact: true });
        await edit.click();
        const editing = page.getByRole("dialog", { name: "Редактирай запис", exact: true });
        const editedName = editing.getByRole("textbox", { name: "Име", exact: true });
        await expect(editing.getByRole("heading", { name: "Редактирай запис", exact: true })).toBeVisible();
        await expect(editedName).toBeFocused();
        await editedName.fill("Ани Тестова");
        await editing.getByRole("textbox", { name: /Бележка/ }).fill("Променена синтетична бележка");
        await page.keyboard.press("Escape");
        await expect(edit).toBeFocused();
        expect((await storedFriends(page)).find((friend) => friend.id === added.id)).toEqual(added);
        await edit.click();
        await expect(editedName).toHaveValue("Ани Тестова");
        await expect(editing.getByRole("textbox", { name: /Бележка/ })).toHaveValue("Променена синтетична бележка");
        await editing.getByRole("button", { name: "Запази промените", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Редактирай Ани Тестова", exact: true })).toBeFocused();
        expect((await storedFriends(page)).find((friend) => friend.id === added.id)).toEqual({ ...added, name: "Ани Тестова", note: "Променена синтетична бележка" });
        await page.reload({ waitUntil: "domcontentloaded" });
        await ready(page, theme);
        await expect(page.getByRole("heading", { name: "Ани Тестова", exact: true })).toBeVisible();
        await page.getByRole("checkbox", { name: "Избери Ани Тестова", exact: true }).check();
        await page.getByRole("button", { name: "Премахни Ани Тестова", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Ани Тестова", exact: true })).toHaveCount(0);
        expect(await storedFriends(page)).toEqual(entries);
        const undo = page.getByRole("button", { name: "Върни записа", exact: true });
        await expect(undo).toBeFocused();
        await undo.click();
        await expect(page.getByRole("checkbox", { name: "Избери Ани Тестова", exact: true })).toBeChecked();
        await expect(add).toBeFocused();
        expect(await storedFriends(page)).toHaveLength(4);
        await noOverflow(page);
      });

      test("filters preserve selection and copy the real current-origin invitation", async ({ page, context }, info) => {
        await openGuestbook(page, theme, entries);
        await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
        const list = page.getByRole("region", { name: "Твоята компания", exact: true });
        const search = list.getByRole("searchbox", { name: "Търси по име или бележка", exact: true });
        const all = list.getByRole("checkbox", { name: "Избери видимите", exact: true });
        await page.getByRole("checkbox", { name: "Избери Мила", exact: true }).check();
        expect(await all.evaluate((element: HTMLInputElement) => element.indeterminate)).toBe(true);
        await search.fill("  ПЕТЪК  ");
        await expect(list.getByRole("listitem")).toHaveCount(1);
        await expect(list.getByRole("heading", { name: "Борис", exact: true })).toBeVisible();
        await all.check();
        await search.fill("несъществуващо синтетично име");
        await expect(list.getByRole("heading", { name: "Няма съвпадения", exact: true })).toBeVisible();
        await expect(all).toBeDisabled();
        await list.getByRole("button", { name: "Изчисти търсенето", exact: true }).click();
        await expect(search).toHaveValue("");
        await expect(list.getByRole("checkbox", { name: "Избери Мила", exact: true })).toBeChecked();
        await expect(list.getByRole("checkbox", { name: "Избери Борис", exact: true })).toBeChecked();
        await expect(list.getByRole("checkbox", { name: "Избери Рада", exact: true })).not.toBeChecked();
        const invitation = page.getByRole("region", { name: "Покана", exact: true });
        const code = invitation.getByRole("textbox", { name: "Код на стаята", exact: true });
        const copy = invitation.getByRole("button", { name: "Копирай поканата", exact: true });
        await code.fill("AB");
        await expect(code).toHaveAttribute("aria-invalid", "true");
        await expect(copy).toBeDisabled();
        await code.fill("https://example.test/lobby/abc234?code=MN2K7A#MN2K7A");
        await expect(code).toHaveValue("ABC234");
        const origin = new URL(page.url()).origin;
        const roomInvite = `Мила, Борис,\nела на масата в Сенките.\nКод: ABC234\n${origin}/lobby/ABC234`;
        const preview = invitation.getByRole("textbox", { name: "Текст на поканата", exact: true });
        await expect(preview).toHaveValue(roomInvite);
        expect(await preview.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
          "The ordinary two-person room invitation should show its entire URL without inner scrolling").toBe(true);
        await copy.click();
        await expect.poll(() => clipboardText(page)).toBe(roomInvite);
        await expect(invitation.getByRole("status")).toHaveText("Поканата е копирана.");
        await invitation.getByRole("radio", { name: "Към сайта", exact: true }).check();
        await expect(code).toHaveCount(0);
        await expect(invitation.getByRole("status")).toHaveCount(0);
        const siteInvite = `Мила, Борис,\nела да играем в Сенките.\n${origin}`;
        await expect(preview).toHaveValue(siteInvite);
        await copy.click();
        await expect.poll(() => clipboardText(page)).toBe(siteInvite);
        await invitation.getByRole("radio", { name: "Към стая", exact: true }).check();
        await expect(code).toHaveValue("ABC234");
        await expect(preview).toHaveValue(roomInvite);
        expect(await storedFriends(page)).toEqual(entries);
        await noOverflow(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await capture(page, info, `guestbook-invitation-${theme}-${width}`);
        await accessible(page);
      });

      test("200 percent text keeps the guestbook and dialog usable without horizontal overflow", async ({ page }, info) => {
        await openGuestbook(page, theme, entries);
        const headingSize = await page.locator("main h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        await doubleGuestbookText(page);
        expect(await page.locator("main h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(headingSize * 2);
        await capture(page, info, `guestbook-text-200-${theme}-${width}`);
        await noOverflow(page);
        const add = page.getByRole("region", { name: "Твоята компания", exact: true }).getByRole("button", { name: "Добави име", exact: true });
        await add.click();
        const dialog = page.getByRole("dialog", { name: "Ново име", exact: true });
        await expect(dialog.getByRole("textbox", { name: "Име", exact: true })).toBeFocused();
        await dialog.getByRole("textbox", { name: "Име", exact: true }).fill("Увеличен текст");
        await dialog.getByRole("textbox", { name: /Бележка/ }).fill("Синтетична чернова при увеличен текст");
        const box = await bounds(dialog);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        await capture(page, info, `guestbook-text-200-dialog-${theme}-${width}`, false);
        await noOverflow(page);
        await page.keyboard.press("Escape");
        await expect(add).toBeFocused();
        expect(await storedFriends(page)).toEqual(entries);
        await add.click();
        await expect(dialog.getByRole("textbox", { name: "Име", exact: true })).toHaveValue("Увеличен текст");
        await expect(dialog.getByRole("textbox", { name: /Бележка/ })).toHaveValue("Синтетична чернова при увеличен текст");
        await page.keyboard.press("Escape");
      });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`wrapped invitations fit at intermediate widths and bound large lists in ${theme}`, async ({ page }, info) => {
    const invitees = [
      { id: "invite-review-a", name: "Александър", note: "Синтетична бележка" },
      { id: "invite-review-b", name: "Екатерина", note: "Синтетична бележка" },
    ];
    await openGuestbook(page, theme, invitees);
    await page.getByRole("checkbox", { name: "Избери видимите", exact: true }).check();
    await page.getByRole("textbox", { name: "Код на стаята", exact: true }).fill("ABC234");
    const preview = page.getByRole("textbox", { name: "Текст на поканата", exact: true });
    for (const width of [320, 390, 768, 821, 900, 1024, 1101, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await preview.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
        `The complete two-person invitation must fit at ${width}px`).toBe(true);
      await expect(preview).toHaveValue(new RegExp(`${new URL(page.url()).origin}/lobby/ABC234$`));
      await noOverflow(page);
    }
    await page.setViewportSize({ width: 900, height: 844 });
    await capture(page, info, `guestbook-wrapped-invitation-${theme}-900`);
    await page.setViewportSize({ width: 320, height: 844 });
    await capture(page, info, `guestbook-wrapped-invitation-${theme}-320`);

    const many = Array.from({ length: 100 }, (_, index) => ({ id: `invite-many-${index}`, name: `Гост ${index}`, note: "" }));
    await replaceFixture(page, theme, many);
    await page.getByRole("checkbox", { name: "Избери видимите", exact: true }).check();
    await page.getByRole("textbox", { name: "Код на стаята", exact: true }).fill("ABC234");
    // Use layout pixels: Firefox may report 480.000061 in floating-point DOMRect bounds.
    expect(await preview.evaluate((element) => (element as HTMLTextAreaElement).offsetHeight)).toBeLessThanOrEqual(480);
    expect(await preview.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await expect(preview).toHaveValue(new RegExp(`${new URL(page.url()).origin}/lobby/ABC234$`));
    await page.getByRole("radio", { name: "Към сайта", exact: true }).check();
    await page.getByRole("checkbox", { name: "Избери видимите", exact: true }).uncheck();
    expect(await preview.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await noOverflow(page);
  });
}

for (const theme of ["light", "dark"] as const) {
test(`approved demo comparison at 1448 by 1086 in ${theme} theme`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1448, height: 1086 });
  const demoEntries = ([
    ["Мила", "Обича да е разказвач."],
    ["Камен", "Винаги има убедително алиби."],
    ["Анна", "Предпочита Върколак."],
    ["Борис", "Първи на масата."],
    ["Елена", "Никога не пропуска петък."],
    ["Георги", "Запази му място."],
  ] as const).map(([name, note], index) => ({ id: `synthetic-demo-${index}`, name, note }));
  await openGuestbook(page, theme, demoEntries);
  await page.getByRole("checkbox", { name: "Избери Мила", exact: true }).check();
  await page.getByRole("checkbox", { name: "Избери Камен", exact: true }).check();
  await page.getByRole("textbox", { name: "Код на стаята", exact: true }).fill("ABC234");
  await page.getByRole("textbox", { name: "Код на стаята", exact: true }).blur();
  const geometry = await assertLayout(page);
  // Honor each browser's scrollbar gutter and keep the heading aligned with the shared navbar.
  const gutter = await page.evaluate(() => innerWidth - document.documentElement.getBoundingClientRect().width);
  expect(geometry.list.x).toBe(192 - gutter / 2);
  expect(geometry.invitation.x + geometry.invitation.width).toBe(1368 - gutter / 2);
  const all = page.getByRole("checkbox", { name: "Избери видимите", exact: true });
  await expect(all).toBeChecked({ indeterminate: true });
  await expect(all.locator("..").locator("svg").last()).toHaveCSS("visibility", "visible");
  await expect(all.locator("..").locator("svg").first()).toHaveCSS("visibility", "hidden");
  await expect(page.getByRole("checkbox", { name: "Избери Мила", exact: true }).locator("..").locator("svg"))
    .toHaveCSS("visibility", "visible");
  await expect(page.getByRole("checkbox", { name: "Избери Анна", exact: true }).locator("..").locator("svg"))
    .toHaveCSS("visibility", "hidden");
  await capture(page, info, `guestbook-demo-${theme}-1448x1086`, false);
  await accessible(page);
});
}
