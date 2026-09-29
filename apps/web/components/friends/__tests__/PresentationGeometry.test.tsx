import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import FriendsPage from "@/app/friends/page";
import FriendsLoading from "@/app/friends/loading";
import friendsStyles from "../Friends.module.css";
import ReplayPage from "@/app/history/[gameId]/replay/page";
import replayStyles from "@/components/history/Replay.module.css";
import { FaqHearth } from "@/components/faq/FaqHearth";

const css = ["faq/LegacyFaq"]
  .map((file) => readFileSync(resolve(process.cwd(), `components/${file}.module.css`), "utf8")
    .replace(/:global\((.+)\)/g, "$1"))
  .join("\n");
const friendsCss = readFileSync(resolve(process.cwd(), "components/friends/Friends.module.css"), "utf8")
  .replace(/:global\(([^)]+)\)/g, "$1");
const friendsClassNames = new Map(
  Array.from(friendsCss.matchAll(/\.([a-zA-Z_][\w-]*)/g), (match) => [friendsStyles[match[1]!], match[1]!] as const),
);
const replayCss = readFileSync(resolve(process.cwd(), "components/history/Replay.module.css"), "utf8")
  .replace(/:global\(([^)]+)\)/g, "$1");
const replayClassNames = new Map(
  Array.from(replayCss.matchAll(/\.([a-zA-Z_][\w-]*)/g), (match) => [replayStyles[match[1]!], match[1]!] as const),
);

function friendsMarkup(markup: string, names = friendsClassNames) {
  // Static browser fixtures use source CSS, so resolve Vitest's module class names back to it.
  const template = document.createElement("template");
  template.innerHTML = markup;
  for (const element of template.content.querySelectorAll("[class]")) {
    element.setAttribute("class", Array.from(element.classList, (name) => names.get(name) ?? name).join(" "));
  }
  return template.innerHTML;
}
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
      it(`keeps friends, replay and help content within the intended layout at ${width}px in ${theme}`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const show = (markup: string, pageCss = css) => page.setContent(
          `<html data-theme="${theme}"><head><style>${reset}${pageCss}</style></head><body>${markup}</body></html>`,
        );
        try {
          const friends = await FriendsPage({ searchParams: Promise.resolve({ visualAuth: "1" }) });
          await show(friendsMarkup(renderToStaticMarkup(friends)), friendsCss);
          const friendsHero = await page.locator("main > header").boundingBox();
          const list = await page.getByRole("region", { name: "Твоята компания", exact: true }).boundingBox();
          const invitation = await page.getByRole("region", { name: "Покана", exact: true }).boundingBox();
          const expectedHeroHeight = width === 390 ? 286 : 328;
          expect(friendsHero!.height).toBeGreaterThanOrEqual(expectedHeroHeight);
          expect(friendsHero!.height).toBeLessThanOrEqual(expectedHeroHeight + 1);
          expect(list!.y).toBeGreaterThanOrEqual(friendsHero!.y + friendsHero!.height);
          expect(list!.y).toBeLessThanOrEqual(friendsHero!.y + friendsHero!.height + 64);
          expect(list!.x).toBeGreaterThanOrEqual(16);
          expect(list!.width).toBeGreaterThanOrEqual(270);
          if (width === 1440) {
            expect(invitation!.x).toBeGreaterThan(list!.x + list!.width);
            expect(invitation!.y - list!.y).toBe(10);
          } else {
            expect(invitation!.y).toBeGreaterThanOrEqual(list!.y + list!.height);
          }
          expect(await page.getByRole("button", { name: "Добави име", exact: true }).isVisible()).toBe(true);
          expect(await page.getByRole("dialog").count()).toBe(0);
          expect(await page.getByRole("form").count()).toBe(0);
          expect(await page.getByRole("textbox", { name: "Име", exact: true }).count()).toBe(0);
          expect(await page.locator("h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(width === 390 ? 40 : 60);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

          await show(friendsMarkup(renderToStaticMarkup(<FriendsLoading />)), friendsCss);
          expect((await page.locator("main > header").boundingBox())!.height).toBe(friendsHero!.height);
          expect(await page.getByRole("status").isVisible()).toBe(true);
          expect(await page.getByRole("form").count()).toBe(0);
          expect(await page.getByRole("textbox", { name: "Име", exact: true }).count()).toBe(0);
          expect(await page.locator(".workspace > .form").count()).toBe(0);
          const loadingList = await page.locator(".workspace > .list").boundingBox();
          const loadingInvitation = await page.locator(".workspace > .invitation").boundingBox();
          expect(loadingList!.x).toBeCloseTo(list!.x);
          expect(loadingList!.width).toBeCloseTo(list!.width);
          expect(loadingList!.y).toBeLessThanOrEqual(friendsHero!.y + friendsHero!.height + 96);
          if (width === 1440) {
            expect(loadingInvitation!.x).toBeCloseTo(invitation!.x);
            expect(loadingInvitation!.width).toBeCloseTo(invitation!.width);
            expect(loadingInvitation!.y - loadingList!.y).toBe(10);
          } else {
            expect(loadingInvitation!.y).toBeGreaterThanOrEqual(loadingList!.y + loadingList!.height);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

          const replay = await ReplayPage({
            params: Promise.resolve({ gameId: "fixture-game-1" }),
            searchParams: Promise.resolve({ visualReplay: "fixture" }),
          });
          await show(friendsMarkup(renderToStaticMarkup(replay), replayClassNames), replayCss);
          const replayHero = await page.locator("main header").first().boundingBox();
          // The approved panoramic replay keeps the first phase in view below the scene.
          expect(replayHero!.height).toBe(width === 390 ? 350 : 410);
          expect(await page.locator("[data-replay-summary] > span").allTextContents()).toEqual([
            "15.05.2026 г., 0:18", "48 мин.", "3 участници", "Пълен запис",
          ]);
          expect(await page.getByText("Последният глас сложи край на вечерта.").isVisible()).toBe(true);
          expect((await page.locator("[data-replay-chapter]:not([hidden])").boundingBox())!.y).toBeLessThan(640);
          expect(await page.locator("h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeCloseTo(width === 390 ? 41.6 : 72);
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
