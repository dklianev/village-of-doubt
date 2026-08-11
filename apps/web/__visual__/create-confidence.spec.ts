import { expect, type Page, test } from "playwright/test";

type CreateFamily = "werewolf" | "mafia";

const CREATE_RANGES = {
  werewolf: { mode: "werewolves_classic", min: 6, max: 30 },
  mafia: { mode: "mafia_free", min: 4, max: 24 },
} as const;

for (const family of Object.keys(CREATE_RANGES) as CreateFamily[]) {
  const range = CREATE_RANGES[family];
  const counts = Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index);
  for (const [chunkIndex, chunk] of chunked(counts, 7).entries()) {
    test(`@create-confidence ${family} full supported range ${chunkIndex + 1}`, async ({ page }) => {
      test.setTimeout(90_000);
      for (const count of chunk) {
        await openCreateWorkspace(page, family, range.mode, count, count % 2 === 0 ? "dark" : "light");
        await expectWorkspaceGeometry(page, count);
      }
    });
  }
}

for (const family of Object.keys(CREATE_RANGES) as CreateFamily[]) {
  const range = CREATE_RANGES[family];
  const mobileCounts = [...new Set(
    [range.min, 8, 12, 18, range.max].filter((count) => count >= range.min && count <= range.max),
  )];
  test(`@create-confidence ${family} mobile summary remains reachable`, async ({ page }) => {
    test.setTimeout(75_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const count of mobileCounts) {
      await openCreateWorkspace(page, family, range.mode, count, "dark", false);
      const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
      await expect(dialog.getByText(`${count} от ${count} места`, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Готово" })).toBeVisible();
      const geometry = await dialog.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    }
  });
}

test("@create-confidence out-of-range counts clamp to playable tables", async ({ page }) => {
  await openCreateWorkspace(page, "werewolf", "werewolves_classic", 3, "dark", false);
  await expect(page.getByRole("dialog", { name: "Настрой детайлите" }).getByText("6 от 6 места", { exact: true })).toBeVisible();

  await openCreateWorkspace(page, "mafia", "mafia_free", 3, "light", false);
  await expect(page.getByRole("dialog", { name: "Настрой детайлите" }).getByText("4 от 4 места", { exact: true })).toBeVisible();

  await openCreateWorkspace(page, "werewolf", "werewolves_classic", 31, "dark", false);
  await expect(page.getByRole("dialog", { name: "Настрой детайлите" }).getByText("30 от 30 места", { exact: true })).toBeVisible();

  await openCreateWorkspace(page, "mafia", "mafia_free", 30, "light", false);
  await expect(page.getByRole("dialog", { name: "Настрой детайлите" }).getByText("24 от 24 места", { exact: true })).toBeVisible();
});

test("@create-confidence sport mafia stays fixed at ten", async ({ page }) => {
  await openCreateWorkspace(page, "mafia", "mafia_sport", 30, "dark", false);
  await expect(page.getByRole("dialog", { name: "Настрой детайлите" }).getByText("10 от 10 места", { exact: true })).toBeVisible();
});

async function openCreateWorkspace(
  page: Page,
  family: CreateFamily,
  mode: string,
  count: number,
  theme: "dark" | "light",
  desktop = true,
) {
  if (desktop) {
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("cookie-consent", "1");
    window.localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
  await page.goto(`/${family}/create?visualAuth=1&mode=${mode}&players=${count}`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "Настрой детайлите" }).click();
  const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await expect(dialog.locator('.role-carousel[data-layout="workspace"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function expectWorkspaceGeometry(page: Page, count: number) {
  const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
  await expect(dialog.getByText(`${count} от ${count} места`, { exact: true })).toBeVisible();
  await expect(dialog.getByText(`${count}/${count} роли`, { exact: false })).toBeVisible();

  const geometry = await dialog.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

  const cards = dialog.locator('.role-carousel[data-layout="workspace"] .role-tile-large');
  await expect(cards.first()).toBeVisible();
  const overlaps = await cards.evaluateAll((elements) => {
    const rectangles = elements.map((element) => element.getBoundingClientRect());
    const collisions: string[] = [];
    for (let first = 0; first < rectangles.length; first += 1) {
      for (let second = first + 1; second < rectangles.length; second += 1) {
        const a = rectangles[first]!;
        const b = rectangles[second]!;
        const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (horizontal > 1 && vertical > 1) {
          collisions.push(`${first}:${second}`);
        }
      }
    }
    return collisions;
  });
  expect(overlaps).toEqual([]);
}

function chunked(values: number[], size: number) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => (
    values.slice(index * size, (index + 1) * size)
  ));
}
