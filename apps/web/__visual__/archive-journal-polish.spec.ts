import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
}
const surfaces = [
  { name: "archive", path: "/history?visualHistory=fixture", ready: ".case-file" },
  { name: "journal", path: "/history/fixture-game-1/replay?visualReplay=fixture" },
  { name: "newspaper", path: "/leaderboard?visualLeaderboard=fixture", ready: ".newspaper-ranking" },
  { name: "collection", path: "/achievements?visualAuth=1&visualAchievements=fixture", ready: ".plaque-wall" },
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1440]) {
    for (const surface of surfaces) {
      test(`${surface.name} ${theme} ${width} keeps readable content inside the viewport`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await prepare(page, theme);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(surface.path);
        const ready = surface.name === "journal"
          ? page.getByRole("region", { name: "Хронология на играта" }).getByRole("heading", { level: 3 }).first()
          : page.locator(surface.ready).first();
        await expect(ready).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const bounds = await ready.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
        await expect(page.locator("main h1")).toHaveCount(1);
        expect(errors).toEqual([]);
        if (width === 390) {
          const accessibility = await new AxeBuilder({ page }).include("main").analyze();
          expect(accessibility.violations).toEqual([]);
        }
        if (surface.name === "journal") {
          expect((await ready.boundingBox())!.y).toBeLessThan(700);
          const roster = page.getByRole("complementary", { name: "Участници в записа" });
          await expect(roster).toBeVisible();
          await expect(roster.getByText("Анна", { exact: true })).toBeVisible();
          await expect(roster.getByText("Борис", { exact: true })).toBeVisible();
          await expect(roster.getByText("Рада", { exact: true })).toBeVisible();
        }
        if (surface.name === "newspaper") {
          expect((await page.locator(".newspaper-ranking tbody tr").nth(3).boundingBox())!.y).toBeLessThan(1000);
          await expect(page.locator(".newspaper-ranking tbody tr")).toHaveCount(18);
        }
      });
    }
  }
}

test("archive filters survive reload and history navigation", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/history?visualHistory=fixture");
  await page.getByLabel("Игра", { exact: true }).selectOption("mafia");
  await page.getByRole("button", { name: "Покажи", exact: true }).click();
  await expect(page).toHaveURL(/family=mafia/);
  await expect(page.locator(".case-file")).toHaveCount(4);
  await page.reload();
  await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("mafia");
  await page.getByRole("link", { name: "Изчисти" }).click();
  await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("all");
  await page.goBack();
  await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("mafia");
});

test("a case keeps the same reference when opening its replay", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/history?visualHistory=fixture");
  const link = page.locator(".case-file a").first();
  const label = await link.getAttribute("aria-label");
  const reference = label!.match(/№(\d+)/)![1];
  await link.click();
  await expect(page).toHaveURL(/\/replay\?visualReplay=fixture/);
  await expect(page.locator("[data-replay-shell] > header")).toContainText(`Дело №${reference}`);
  await expect(page.getByRole("heading", { level: 1, name: "Селото оцеля.", exact: true })).toBeVisible();
});

test("long replay reaches the final event after the old 1000-event boundary", async ({ page }) => {
  test.setTimeout(90_000);
  await prepare(page, "dark");
  await page.goto("/history/fixture-game-1/replay?visualReplay=long");
  const events = page.getByRole("region", { name: "Хронология на играта" }).getByRole("heading", { level: 4, includeHidden: true });
  const seenTimes = new Set<string>();
  for (let part = 0; part < 5; part++) {
    await expect(events).toHaveCount(200);
    await expect(page.getByRole("link", { name: "Към развръзката", exact: true })).toHaveCount(0);
    for (const timestamp of await events.evaluateAll((headings) => headings.map((heading) => heading.closest("li")!.querySelector("time")!.dateTime))) {
      expect(seenTimes.has(timestamp), "Continuation must not repeat an earlier event").toBe(false);
      seenTimes.add(timestamp);
    }
    await page.getByRole("link", { name: "Следващи събития" }).click();
    await expect(page.getByRole("heading", { name: "Продължение на записа" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`00000000${String((part + 1) * 200).padStart(4, "0")}`));
  }
  await expect(events).toHaveCount(5);
  await expect(events.last().locator("..")).toContainText("Играта приключи.");
  for (const timestamp of await events.evaluateAll((headings) => headings.map((heading) => heading.closest("li")!.querySelector("time")!.dateTime))) {
    expect(seenTimes.has(timestamp)).toBe(false);
    seenTimes.add(timestamp);
  }
  expect(seenTimes.size).toBe(1005);
  const resolution = page.getByRole("link", { name: "Към развръзката", exact: true });
  await expect(resolution).toBeVisible();
  const target = await resolution.getAttribute("href");
  expect(target).toMatch(/^#.+/);
  await resolution.click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.locator(target!)).toBeFocused();
  await expect(page.locator(target!)).toBeVisible();
  await expect(events).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Следващи събития" })).toHaveCount(0);
  await page.getByRole("link", { name: "Към началото" }).click();
  await expect(events).toHaveCount(200);
});

test("replay unavailable and empty states remain distinct", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/history/fixture-game-1/replay?visualReplay=unavailable");
  await expect(page.getByRole("alert")).toContainText("временно не е достъпен");
  await expect(page.getByRole("link", { name: "Опитай отново" })).toBeVisible();
  await page.goto("/history/fixture-game-1/replay?visualReplay=empty");
  await expect(page.getByRole("heading", { name: "Няма записани събития" })).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("an expired replay continuation offers a working restart without repeating events", async ({ page }) => {
  await prepare(page, "light");
  const cursor = "2026-05-14T20:30:00.000Z~00000000-0000-4000-8000-999999999999";
  await page.goto(`/history/fixture-game-1/replay?visualReplay=fixture&after=${encodeURIComponent(cursor)}`);
  await expect(page.getByRole("alert")).toContainText("Продължението на записа вече не е достъпно");
  await expect(page.getByRole("region", { name: "Хронология на играта" })).toHaveCount(0);
  const restart = page.getByRole("link", { name: "Към началото", exact: true });
  await expect(restart).toHaveAttribute("href", "/history/fixture-game-1/replay?visualReplay=fixture");
  await restart.click();
  await expect(page).toHaveURL(/replay\?visualReplay=fixture$/);
  await expect(page.getByRole("heading", { name: "Ходът на вечерта", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Хронология на играта" }).getByRole("heading", { level: 4, includeHidden: true })).toHaveCount(8);
  await expect(page.locator("main:visible").getByRole("alert")).toHaveCount(0);
});
