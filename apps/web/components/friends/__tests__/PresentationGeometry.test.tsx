import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import FriendsPage from "@/app/friends/page";
import ReplayPage from "@/app/history/[gameId]/replay/page";
import { FaqHearth } from "@/components/faq/FaqHearth";

const css = ["friends/LegacyFriends", "history/LegacyReplay", "faq/LegacyFaq"]
  .map((file) => readFileSync(resolve(process.cwd(), `components/${file}.module.css`), "utf8")
    .replace(/:global\((.+)\)/g, "$1"))
  .join("\n");
const reset = "* { box-sizing: border-box; } body { margin: 0; } h1,h2,h3,p { margin: 0; }";
let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
});

describe("utility presentation geometry", () => {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"]) {
      it(`keeps friends, replay and help headers compact at ${width}px in ${theme}`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const show = (markup: string) => page.setContent(
          `<html data-theme="${theme}"><head><style>${reset}${css}</style></head><body>${markup}</body></html>`,
        );
        try {
          const friends = await FriendsPage({ searchParams: Promise.resolve({ visualAuth: "1" }) });
          await show(renderToStaticMarkup(friends));
          const friendsHero = await page.locator(".friends-hero").boundingBox();
          const form = await page.getByRole("form").boundingBox();
          const list = await page.getByRole("region", { name: "Запазени места" }).boundingBox();
          expect(friendsHero!.height).toBeLessThanOrEqual(300);
          expect(form!.y).toBeLessThanOrEqual(340);
          expect(list!.y).toBeLessThanOrEqual(740);
          expect(await page.locator("h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(40);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

          const replay = await ReplayPage({
            params: Promise.resolve({ gameId: "fixture-game-1" }),
            searchParams: Promise.resolve({ visualReplay: "fixture" }),
          });
          await show(renderToStaticMarkup(replay));
          const replayHero = await page.locator(".replay-hero-v2").boundingBox();
          expect(replayHero!.height).toBeLessThanOrEqual(400);
          expect(await page.locator(".replay-summary > div:visible > span").allTextContents()).toEqual([
            "Режим", "Времетраене", "Събития",
          ]);
          expect(await page.locator(".replay-verdict-card h2").isVisible()).toBe(true);
          expect(await page.locator("h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(40);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

          await show(`<main class="faq-shell">${renderToStaticMarkup(<FaqHearth items={[]} />)}</main>`);
          const helpHero = await page.locator(".faq-hearth-hero").boundingBox();
          expect(helpHero!.height).toBeLessThanOrEqual(240);
          expect(await page.getByRole("searchbox").isVisible()).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        } finally {
          await page.close();
        }
      });
    }
  }
});
