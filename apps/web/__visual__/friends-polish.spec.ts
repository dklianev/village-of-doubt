import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

test.use({ serviceWorkers: "block" });

const storageKey = "werewolf-mafia-friends-v1";
const entries = [
  { id: "fixture-mila", name: "Мила", note: "Обича да е разказвач" },
  { id: "fixture-boris", name: "Борис", note: "Свободен в петък вечер" },
  { id: "fixture-rada", name: "Рада", note: "Предпочита Мафия" },
];

async function prepare(page: Page, theme: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.addInitScript(({ theme }) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    const fixture = window as typeof window & { friendsCopied?: string; friendsCopyFails?: boolean };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => {
        if (fixture.friendsCopyFails) throw new DOMException("fixture denial", "NotAllowedError");
        fixture.friendsCopied = value;
      },
    } });
    Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
  }, { theme });
  return errors;
}

async function seed(page: Page, value: unknown) {
  await expect(page.locator(".auth-chip-slot").first()).toHaveAttribute("data-auth-state", "guest");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: storageKey, value });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Познати на масата", exact: true })).toBeVisible();
  await expect(page.locator("main > div[aria-busy]")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => document.fonts.ready);
}

async function storedEntries(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as typeof entries, storageKey);
}

async function openForm(page: Page) {
  await page.getByRole("region", { name: "Твоята компания", exact: true }).getByRole("button", { name: "Добави име", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function closeForm(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Затвори", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("room invitations extract the route code without query or fragment overrides", async ({ page }) => {
  const errors = await prepare(page, "light");
  await page.goto("/friends?visualAuth=1");
  const code = page.getByRole("textbox", { name: "Код на стаята", exact: true });
  for (const input of [
    "https://senkite.com/lobby/ABC234?utm_source=whatsapp#MN2K7A",
    "/mafia/join/ABC234?code=MN2K7A",
    "https://senkite.com/join?code=ABC234&utm_source=whatsapp",
  ]) {
    await code.fill(input);
    await expect(code).toHaveValue("ABC234");
    await page.getByRole("button", { name: "Копирай поканата", exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as typeof window & { friendsCopied?: string }).friendsCopied)).toContain("/lobby/ABC234");
  }
  await code.fill("https://senkite.com/lobby/INVALID?code=ABC234#MN2K7A");
  await expect(code).toHaveValue("");
  await expect(page.getByRole("button", { name: "Копирай поканата", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const theme of ["light", "dark"]) {
  test.describe(`friends draft safety ${theme}`, () => {
    test.use({ viewport: theme === "light" ? { width: 390, height: 844 } : { width: 1440, height: 960 } });

    for (const hidden of [false, true]) {
      test(`same-record intertab edits require comparison ${hidden ? "after Activity resume" : "while visible"}`, async ({ page, context }, info) => {
        const errors = await prepare(page, theme);
        await page.goto("/friends?visualAuth=1");
        await seed(page, entries);
        if (hidden) {
          // Establish forward history before opening the modal, whose backdrop makes page links inert.
          await page.locator('header a[href="/"]').first().click();
          await expect(page).toHaveURL(/\/$/);
          await page.goBack();
          await expect(page.getByRole("heading", { name: "Познати на масата", exact: true })).toBeVisible();
        }
        await page.getByRole("button", { name: "Редактирай Мила", exact: true }).click();
        const name = page.getByRole("textbox", { name: "Име", exact: true });
        await name.fill("Милена");
        const other = await context.newPage();
        try {
          const otherErrors = await prepare(other, theme);
          await other.goto("/friends?visualAuth=1");
          await other.getByRole("button", { name: "Редактирай Мила", exact: true }).click();
          await other.getByLabel(/Бележка/).fill("Запазена от друг раздел");
          if (hidden) {
            await page.goForward();
            await expect(page).toHaveURL(/\/$/);
            await expect(page.locator("#friend-name")).toHaveCount(1);
            await expect(page.locator("#friend-name")).toBeHidden();
            await expect(page.locator("dialog[open]")).toHaveCount(0);
            await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
          }
          await other.getByRole("button", { name: "Запази промените", exact: true }).click();
          await expect(other.getByRole("status")).toContainText("Промяната е запазена");
          if (hidden) {
            await page.goBack();
            await expect(page).toHaveURL(/\/friends\?visualAuth=1$/);
          }
          await expect(page.getByRole("dialog", { name: "Редактирай запис", exact: true })).toBeVisible();
          await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
          const conflict = page.getByRole("region", { name: "Конфликт при редакция" });
          await expect(conflict).toBeVisible();
          await expect(conflict).toContainText("Запазена от друг раздел");
          await expect(name).toHaveValue("Милена");
          await expect(page.getByLabel(/Бележка/)).toHaveValue(entries[0]!.note);
          await expect(page.getByRole("button", { name: "Запази промените", exact: true })).toBeDisabled();
          expect((await storedEntries(page))[0]).toEqual({ ...entries[0], note: "Запазена от друг раздел" });
          expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
          await conflict.scrollIntoViewIfNeeded();
          await page.screenshot({ path: info.outputPath(`friends-conflict-${hidden ? "resumed" : "visible"}-${theme}.png`), fullPage: true });
          await conflict.getByRole("button", { name: "Продължи с черновата" }).click();
          expect((await storedEntries(page))[0]!.name).toBe("Мила");
          await page.getByLabel(/Бележка/).fill("Запазена от друг раздел; моя добавка");
          await name.press("Enter");
          await expect(page.getByRole("heading", { name: "Милена", exact: true })).toBeVisible();
          expect((await storedEntries(page))[0]).toEqual({ ...entries[0], name: "Милена", note: "Запазена от друг раздел; моя добавка" });
          expect(errors).toEqual([]);
          expect(otherErrors).toEqual([]);
        } finally {
          await other.close();
        }
      });
    }

    test("switching targets preserves drafts until an explicit discard", async ({ page }, info) => {
      const errors = await prepare(page, theme);
      await page.goto("/friends?visualAuth=1");
      await seed(page, entries);
      await openForm(page);
      const name = page.getByRole("textbox", { name: "Име", exact: true });
      const note = page.getByLabel(/Бележка/);
      await name.fill("Анна");
      await note.fill("Незапазена бележка");
      await closeForm(page);
      await page.getByRole("button", { name: "Редактирай Мила", exact: true }).click();
      const confirmation = page.getByRole("region", { name: "Незапазена чернова" });
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByRole("button", { name: "Остани в черновата" })).toBeFocused();
      await expect(name).toHaveValue("Анна");
      await expect(note).toHaveValue("Незапазена бележка");
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: info.outputPath(`friends-draft-confirmation-${theme}.png`), fullPage: true });
      await page.keyboard.press("Enter");
      await expect(name).toBeFocused();
      await expect(name).toHaveValue("Анна");
      await closeForm(page);
      await page.getByRole("button", { name: "Редактирай Мила", exact: true }).click();
      await confirmation.getByRole("button", { name: "Изхвърли черновата" }).click();
      await expect(name).toHaveValue("Мила");
      await name.fill("Милена");
      await closeForm(page);
      await page.getByRole("button", { name: "Редактирай Мила", exact: true }).click();
      await expect(name).toHaveValue("Милена");
      await expect(confirmation).toBeHidden();
      await closeForm(page);
      await page.getByRole("button", { name: "Редактирай Борис", exact: true }).click();
      await expect(name).toHaveValue("Милена");
      await confirmation.getByRole("button", { name: "Изхвърли черновата" }).click();
      await expect(name).toHaveValue("Борис");
      await expect(note).toHaveValue(entries[1]!.note);
      expect(await storedEntries(page)).toEqual(entries);
      expect(errors).toEqual([]);
    });

    test("another tab's unrelated addition leaves removal undo available", async ({ page, context }) => {
      const errors = await prepare(page, theme);
      await page.goto("/friends?visualAuth=1");
      await seed(page, entries);
      await page.getByRole("checkbox", { name: "Избери Мила", exact: true }).check();
      await page.getByRole("button", { name: "Премахни Мила", exact: true }).click();
      const other = await context.newPage();
      try {
        await prepare(other, theme);
        await other.goto("/friends?visualAuth=1");
        await openForm(other);
        await other.getByRole("textbox", { name: "Име", exact: true }).fill("Анна");
        await other.getByLabel(/Бележка/).fill("Друга бележка");
        await other.getByRole("dialog").getByRole("button", { name: "Добави име", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Анна", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Върни записа", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Мила", exact: true })).toBeVisible();
        await expect(page.getByRole("checkbox", { name: "Избери Мила", exact: true })).toBeChecked();
        const saved = await storedEntries(page);
        expect(saved).toHaveLength(4);
        expect(saved.find((friend) => friend.id === entries[0]!.id)).toEqual(entries[0]);
        expect(saved.find((friend) => friend.name === "Анна")?.note).toBe("Друга бележка");
        expect(errors).toEqual([]);
      } finally {
        await other.close();
      }
    });
  });
}

for (const theme of ["dark", "light"]) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 960 }]) {
    test.describe(`friends polish ${theme} ${viewport.width}`, () => {
      test.use({ viewport });
      test("empty, populated, full and malformed local books remain usable", async ({ page }, info) => {
        const errors = await prepare(page, theme);
        await page.goto("/friends?visualAuth=1");
        await expect(page.getByRole("heading", { name: "Още няма вписани имена" })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await openForm(page);
        const name = page.getByRole("textbox", { name: "Име", exact: true });
        const note = page.getByLabel(/Бележка/);
        const nameBox = await name.boundingBox();
        const noteBox = await note.boundingBox();
        expect(nameBox!.x).toBeGreaterThanOrEqual(16);
        expect(nameBox!.width).toBeGreaterThan(270);
        expect(noteBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height);
        const primary = page.getByRole("dialog").getByRole("button", { name: "Добави име", exact: true });
        await expect(primary).toHaveCSS("background-color", theme === "light" ? "rgb(141, 47, 41)" : "rgb(158, 52, 45)");
        await expect(page.getByText(/запазени места|запазена маса/)).toHaveCount(0);
        const art = await page.locator("body").evaluate(async (element) => {
          const urls = [...getComputedStyle(element, "::before").backgroundImage.matchAll(/url\("([^"]+)"\)/g)];
          const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
          const loaded = urls.find((match) => resources.includes(new URL(match[1]!, location.href).href));
          const image = new Image(); image.src = (loaded ?? urls[0])![1]!; await image.decode();
          return { url: image.src, width: image.naturalWidth };
        });
        expect(art.url).toContain(`bg-friends-invitation-${theme}-v1`);
        expect(art.width).toBeGreaterThanOrEqual(390);
        await page.screenshot({ path: info.outputPath(`friends-add-${theme}-${viewport.width}.png`), fullPage: true });
        expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
        await closeForm(page);
        await page.screenshot({ path: info.outputPath(`friends-empty-${theme}-${viewport.width}.png`), fullPage: true });
        expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);

        await seed(page, entries);
        await expect(page.getByRole("heading", { name: "Мила", exact: true })).toBeVisible();
        await page.getByRole("checkbox", { name: "Избери Мила", exact: true }).focus();
        await page.keyboard.press("Space");
        await expect(page.getByRole("checkbox", { name: "Избери Мила", exact: true })).toBeChecked();
        await page.getByRole("button", { name: "Редактирай Мила", exact: true }).click();
        await expect(name).toBeFocused();
        await name.fill("Милена");
        await note.fill("Синтетична бележка");
        await name.press("Enter");
        await expect(page.getByRole("heading", { name: "Милена", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Премахни Борис", exact: true }).click();
        await page.getByRole("button", { name: "Върни записа", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Борис", exact: true })).toBeVisible();
        await page.getByRole("textbox", { name: "Код на стаята" }).fill("https://example.test/lobby/abc234");
        await page.getByRole("button", { name: "Копирай поканата" }).click();
        await expect(page.getByText("Поканата е копирана.", { exact: true })).toBeVisible();
        const copied = await page.evaluate(() => (window as typeof window & { friendsCopied: string }).friendsCopied);
        expect(copied).toBe(`Милена,\nела на масата в Сенките.\nКод: ABC234\n${new URL(page.url()).origin}/lobby/ABC234`);
        await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: info.outputPath(`friends-list-${theme}-${viewport.width}.png`), fullPage: true });
        expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);

        await seed(page, Array.from({ length: 100 }, (_, index) => ({ id: `fixture-${index}`, name: index === 0 ? "Я".repeat(60) : `Познат ${index}`, note: index === 0 ? "Бележка ".repeat(30) : "Вечерна компания" })));
        await openForm(page);
        await expect(primary).toBeDisabled();
        await expect(page.getByRole("dialog")).toContainText("Гостовата книга е пълна: 100 записа.");
        expect(await storedEntries(page)).toHaveLength(100);
        await closeForm(page);
        await page.getByRole("searchbox").fill("Познат 99");
        await expect(page.getByRole("heading", { name: "Познат 99", exact: true })).toBeVisible();
        await page.getByRole("searchbox").fill("непознато име");
        await expect(page.getByRole("heading", { name: "Няма съвпадения" })).toBeVisible();
        await page.getByRole("button", { name: "Изчисти търсенето" }).click();
        await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: info.outputPath(`friends-full-${theme}-${viewport.width}.png`), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

        await seed(page, [null, entries[0]]);
        await expect(page.locator("main").getByRole("alert")).toContainText("Оригиналът е непроменен");
        expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(JSON.stringify([null, entries[0]]));
        await page.screenshot({ path: info.outputPath(`friends-error-${theme}-${viewport.width}.png`), fullPage: true });
        expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
        await openForm(page);
        await expect(primary).toBeDisabled();
        await closeForm(page);
        await page.getByRole("button", { name: "Възстанови с резервно копие" }).click();
        await openForm(page);
        await expect(primary).toBeEnabled();
        await closeForm(page);
        expect(await page.evaluate((key) => localStorage.getItem(`${key}-recovery`), storageKey)).toBe(JSON.stringify([null, entries[0]]));
        expect(errors).toEqual([]);
      });
    });
  }
}

test("friends denied storage and clipboard keep drafts and expose manual copy", async ({ page }) => {
  const errors = await prepare(page, "light");
  await page.goto("/friends?visualAuth=1");
  await seed(page, entries);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("fixture quota", "QuotaExceededError");
      return original.call(this, name, value);
    };
    (window as typeof window & { friendsCopyFails: boolean }).friendsCopyFails = true;
  }, storageKey);
  await openForm(page);
  const name = page.getByRole("textbox", { name: "Име", exact: true });
  await name.fill("Синтетично име");
  await name.press("Enter");
  await expect(page.locator("main").getByRole("alert")).toContainText("не успя да запази");
  await expect(name).toHaveValue("Синтетично име");
  expect(await storedEntries(page)).toEqual(entries);
  await closeForm(page);
  await page.getByRole("radio", { name: "Към сайта" }).check();
  await page.getByRole("button", { name: "Копирай поканата" }).click();
  await expect(page.getByText("Копирането не успя. Текстът е маркиран за ръчно копиране.")).toBeVisible();
  const text = page.getByRole("textbox", { name: "Текст на поканата" });
  await expect(text).toBeFocused();
  expect(await text.evaluate((element: HTMLTextAreaElement) => element.selectionStart === 0 && element.selectionEnd === element.value.length)).toBe(true);
  await expect(text).not.toHaveValue(/\/lobby\//);
  await openForm(page);
  await expect(name).toHaveValue("Синтетично име");
  expect(await storedEntries(page)).toEqual(entries);
  expect(errors).toEqual([]);
});
