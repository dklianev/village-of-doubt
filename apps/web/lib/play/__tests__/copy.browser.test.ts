import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { phaseGuideBg } from "../copy";
import { ROLE_GUIDE_BG } from "../private-copy";

const baseUrl = process.env.PLAY_COPY_BASE_URL;
const artifacts = process.env.PLAY_COPY_ARTIFACT_DIR ?? join(tmpdir(), "play-copy");
const scenarios = [
  { family: "mafia", mode: "mafia_sport", phase: "day_discussion", role: "civilian" },
  { family: "mafia", mode: "mafia_sport", phase: "nomination", role: "civilian" },
  { family: "mafia", mode: "mafia_free", phase: "day_discussion", role: "civilian" },
  { family: "mafia", mode: "mafia_free", phase: "night", role: "mafioso" },
  { family: "werewolves", mode: "werewolves_classic", phase: "night", role: "werewolf" },
  { family: "werewolves", mode: "werewolves_classic", phase: "night", role: "vampire" },
  { family: "werewolves", mode: "werewolves_classic", phase: "night", role: "priest" },
] as const;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

describe.skipIf(!baseUrl)("synthetic play copy", () => {
  beforeAll(async () => {
    mkdirSync(artifacts, { recursive: true });
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const width of [320, 1440]) {
    for (const theme of ["dark", "light"]) {
      for (const scenario of scenarios) {
        const name = `${scenario.mode}-${scenario.phase}-${scenario.role}-${theme}-${width}`;
        it(name, async () => {
          const context = await browser.newContext({
            viewport: { width, height: width < 1024 ? 844 : 1000 },
            reducedMotion: "reduce",
          });
          try {
            await context.addInitScript((theme) => {
              localStorage.setItem("werewolf-theme", theme);
              localStorage.setItem("cookie-consent", "1");
              localStorage.setItem("welcome-modal-shown", "1");
            }, theme);
            const page = await context.newPage();
            page.setDefaultTimeout(10_000);
            page.setDefaultNavigationTimeout(30_000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
            const params = new URLSearchParams({ visualGame: "1", players: "10", ...scenario });
            await page.goto(`${baseUrl}/play/VISUAL?${params}`, { waitUntil: "domcontentloaded" });
            await page.locator('.play-stage[data-layout-ready="true"]').waitFor();
            await page.evaluate(() => document.fonts.ready);
            expect(await page.title()).toContain("Сенките");
            expect(new URL(page.url()).pathname).toBe("/play/VISUAL");

            if (scenario.mode === "mafia_sport") {
              const heading = scenario.phase === "nomination" ? "Преглед на номинациите" : "Твоята 60-секундна реч";
              expect(await page.locator(".play-action-dock").getByRole("heading", { name: heading, level: 2 }).isVisible()).toBe(true);
              if (scenario.phase === "nomination") {
                expect(await page.getByRole("button", { name: /^(Номинирай|Смени)$/ }).count()).toBe(0);
                expect(await page.getByText("Номинациите са отворени").count()).toBe(0);
              }
            }

            const card = page.locator('[data-private-dossier="true"]');
            await card.getByText("За ролята", { exact: true }).click();
            const guide = ROLE_GUIDE_BG[scenario.role]!;
            expect(await card.getByText(guide.summary, { exact: true }).isVisible()).toBe(true);
            const goal = card.getByText(guide.win, { exact: true });
            await goal.scrollIntoViewIfNeeded();
            if (width < 1024) {
              await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
              const bounds = await goal.boundingBox();
              const dock = await page.locator(".play-action-dock").isVisible()
                ? await page.locator(".play-action-dock").boundingBox() : null;
              expect(bounds).not.toBeNull();
              expect(bounds!.y).toBeGreaterThanOrEqual(0);
              expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(dock?.y ?? 844);
            }
            expect(await goal.isVisible()).toBe(true);
            const fits = await card.locator("p, strong").evaluateAll((elements) => elements.every((element) => {
              if (!element.getClientRects().length) return true;
              const range = document.createRange();
              range.selectNodeContents(element);
              const text = range.getBoundingClientRect();
              const container = element.parentElement!.getBoundingClientRect();
              return text.left >= container.left - 1 && text.right <= container.right + 1;
            }));
            expect(fits).toBe(true);
            await card.screenshot({ path: join(artifacts, `${name}-role.png`) });

            if (scenario.phase !== "night") {
              if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
              await page.getByRole("button", { name: "Правила", exact: true }).click();
              const dialog = page.getByRole("dialog", { name: "Правила на масата" });
              const phase = phaseGuideBg(scenario.phase, scenario.mode);
              await dialog.getByRole("heading", { name: phase.title, exact: true }).waitFor();
              expect(await dialog.getByRole("heading", { name: phase.title, exact: true }).isVisible()).toBe(true);
              expect(await dialog.getByText(phase.body, { exact: true }).isVisible()).toBe(true);
              expect(await dialog.getByText(phase.wakes, { exact: true }).isVisible()).toBe(true);
              await page.screenshot({ path: join(artifacts, `${name}-phase.png`) });
              await page.keyboard.press("Escape");
              await dialog.waitFor({ state: "hidden" });
              expect(await dialog.count()).toBe(0);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        }, 60_000);
      }
    }
  }
});
