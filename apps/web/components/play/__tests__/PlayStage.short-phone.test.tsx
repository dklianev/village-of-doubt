import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PublicPlayer } from "@/lib/play/types";

// Use the installed test toolchain's CSS Modules compiler, including :global selectors.
const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve("vitest/package.json"))("lightningcss") as {
  transform(options: { filename: string; code: Buffer; cssModules: boolean }): {
    code: Buffer;
    exports: Record<string, { name: string }>;
  };
};
const css = ["play/PlayRoom", "play/PlayStage", "play/PlaySeat", "play/Timer", "play/PlayActionDock", "ProfilePortrait"].map((name) => {
  const filename = resolve(process.cwd(), `components/${name}.module.css`);
  const compiled = transform({ filename, code: readFileSync(filename), cssModules: true });
  vi.doMock(filename, () => ({
    default: Object.fromEntries(Object.entries(compiled.exports).map(([key, value]) => [key, value.name])),
  }));
  return compiled.code.toString();
}).join("\n");
const { PlayStage } = await import("@/components/play/PlayStage");
const { PlayActionDock } = await import("@/components/play/PlayActionDock");
const globals = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8").replace(/^@import .+;$/gm, "");
const fonts = [["Literata", "literata-reading"], ["Sofia", "sofia-sans-interface"]].map(([family, file]) =>
  `@font-face { font-family: ${family}; src: url(data:font/woff2;base64,${readFileSync(resolve(process.cwd(), `app/fonts/${file}.woff2`)).toString("base64")}); font-weight: 400 700; }`,
).join("\n");
const artifactDir = process.env.SHORT_PHONE_ARTIFACT_DIR;
const viewports = [{ width: 320, height: 568 }, { width: 430, height: 640 }, { width: 390, height: 844 }];
let browser: Awaited<ReturnType<typeof chromium.launch>>;

beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

function fixture(family: "mafia" | "werewolves", measured: boolean) {
  const players: PublicPlayer[] = ["Антон", "Борис", "Вера", "Георги", "Дани", "Емил", "Жана", "Захари"].map((displayName, index) => ({
    userId: `fixture-${index}`, displayName, avatarId: "portrait-f01", connected: true,
    ready: true, playing: true, alive: index !== 7, host: false, narrator: false,
    acceptedFullNarrator: false, mayor: false, hasVoted: false, actedThisPhase: false, revealedRole: "",
  }));
  return renderToStaticMarkup(
    <>
      <header data-fixture-chrome>Сенките</header>
      <main className="play-shell game-shell framed-shell" data-family={family} data-phase="night">
        <div className="play-shell-inner framed-shell-inner">
          <nav className="play-mobile-navigation">
            <button aria-pressed="true">Масата</button><button>Разговор</button>
          </nav>
          <div className="play-layout" data-mobile-view="table">
            <div className="play-primary-column">
              <PlayStage code="VISUAL" phase="night" mode={family === "mafia" ? "mafia_sport" : "werewolves_classic"}
                family={family} round={2} phaseEndsAt={0} isPending={false} players={players} hasSnapshot
                narratorMode="automatic" communicationMode="built_in_chat" ownPlayer={players[0]}
                targetableIds={new Set(players.slice(1, 7).map((player) => player.userId))}
                shortcutNumbers={new Map()} selectedTargetId="" secondTargetId="" voteCounts={new Map()}
                currentSpeakerUserId="" currentDefenseUserId="" nomineeIds={new Set()}
                onSelectSeat={() => {}} onMakeNarrator={() => {}} onMakeMayor={() => {}}
              />
              <section className="play-personal-area">Лично досие</section>
            </div>
            <div className="play-interaction-column">
              <PlayActionDock eyebrow="личен ход" heading="Нощен ход · избери цел" kind="action"
                compact={measured} expanded={false} onExpandedChange={() => {}}
                primaryContent={<button>Потвърди</button>}
              />
            </div>
          </div>
        </div>
      </main>
      {measured ? <button data-fixture-dev-indicator aria-label="Development indicator">N</button> : null}
    </>,
  );
}

describe("short-phone stage CSS without a Next runtime", () => {
  for (const family of ["mafia", "werewolves"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const measured of [false, true]) {
        it.each(viewports)(`${family} ${theme} ${measured ? "measured" : "initial"} at $width x $height keeps eight seats and the dock title clear`, async (viewport) => {
          const page = await browser.newPage({ viewport });
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          try {
            await page.route("https://short-phone.test/**", async (route) => {
              const url = new URL(route.request().url());
              const asset = url.pathname === "/_next/image" ? url.searchParams.get("url")! : url.pathname;
              const path = resolve(process.cwd(), "public", `.${asset}`);
              if (!path.startsWith(resolve(process.cwd(), "public") + "/") && !path.startsWith(resolve(process.cwd(), "public") + "\\")) {
                return route.abort();
              }
              try { await route.fulfill({ path }); } catch { await route.abort(); }
            });
            await page.setContent(`<html data-theme="${theme}"><head><base href="https://short-phone.test/">
              <style>${fonts}
                :root { --font-literata: Literata; --font-sofia: Sofia; }
                h1,h2,h3,p { margin: 0; }
                ${globals}
                ${css}
                /* Reserve SiteChrome's 64px row; the app shell and all tested geometry use real CSS. */
                [data-fixture-chrome] { position: relative; z-index: 40; height: 64px; background: var(--chrome-bg); text-align: center; font: 700 32px/64px Literata; }
                /* Synthetic bounds of the development-only indicator seen in CI, not app UI. */
                [data-fixture-dev-indicator] { position: fixed; z-index: 100; left: 18px; bottom: 18px; width: 36px; height: 36px; padding: 0; border: 1px solid #444; border-radius: 50%; background: #111; color: white; }
              </style></head><body>${fixture(family, measured)}</body></html>`);
            await page.evaluate(async (measured) => {
              await document.fonts.ready;
              if (measured) document.querySelector(".play-stage")!.setAttribute("data-layout-ready", "true");
            }, measured);
            const geometry = await page.evaluate(() => {
              const rect = (selector: string) => {
                const element = document.querySelector(selector)!;
                const { x, y, width, height } = element.getBoundingClientRect();
                return { x, y, width, height };
              };
              return {
                stage: rect(".play-stage"), title: rect(".play-stage h1"), core: rect("[data-table-core]"),
                counts: rect("[data-table-core] > span:last-child"), dock: rect("[data-play-command-surface]"),
                dockTitle: rect(".play-action-dock-head h2"), personal: rect(".play-personal-area"),
                seats: [...document.querySelectorAll("[data-seat-token]")].map((element) => {
                  const { x, y, width, height } = element.getBoundingClientRect();
                  return { x, y, width, height };
                }),
                fontsLoaded: document.fonts.check("700 20px Literata") && document.fonts.check("700 12px Sofia"),
                titleFontSize: getComputedStyle(document.querySelector(".play-stage h1")!).fontSize,
                stagePadding: getComputedStyle(document.querySelector(".play-stage")!).paddingTop,
                hudGap: getComputedStyle(document.querySelector("[data-stage-hud]")!).rowGap,
                overflow: document.documentElement.scrollWidth,
              };
            });
            if (artifactDir) {
              mkdirSync(artifactDir, { recursive: true });
              await page.screenshot({ path: join(artifactDir, `${family}-${theme}-${measured ? "measured" : "initial"}-${viewport.width}x${viewport.height}.png`) });
              console.info(JSON.stringify({ family, theme, measured, viewport, ...geometry }));
            }
            expect(geometry.fontsLoaded).toBe(true);
            expect(geometry.titleFontSize).toBe(viewport.height <= 640 ? "20px" : "24px");
            expect(geometry.stagePadding).toBe(viewport.height <= 640 ? "8px" : "16px");
            expect(geometry.hudGap).toBe(viewport.height <= 640 ? "4px" : "8px");
            expect(geometry.seats).toHaveLength(8);
            expect(geometry.core.height).toBe(74);
            expect(geometry.counts.y + geometry.counts.height + 4).toBeLessThanOrEqual(Math.min(...geometry.seats.map((seat) => seat.y)));
            expect(geometry.personal.y).toBeGreaterThanOrEqual(geometry.stage.y + geometry.stage.height);
            for (const seat of geometry.seats) {
              expect(seat.width).toBeGreaterThanOrEqual(44);
              expect(seat.height).toBeGreaterThanOrEqual(44);
              expect(seat.y + seat.height, JSON.stringify(geometry)).toBeLessThanOrEqual(geometry.dock.y - 4);
            }
            expect(geometry.dockTitle.x).toBeGreaterThanOrEqual(geometry.dock.x);
            expect(geometry.dockTitle.x + geometry.dockTitle.width).toBeLessThanOrEqual(viewport.width);
            expect(geometry.dockTitle.y).toBeGreaterThanOrEqual(geometry.dock.y);
            expect(geometry.dockTitle.y + geometry.dockTitle.height).toBeLessThanOrEqual(geometry.dock.y + geometry.dock.height);
            if (measured) {
              const indicator = (await page.locator("[data-fixture-dev-indicator]").boundingBox())!;
              expect(geometry.dockTitle.x).toBeGreaterThanOrEqual(indicator.x + indicator.width + 4);
              const toggle = (await page.locator(".play-action-dock-toggle").boundingBox())!;
              expect(geometry.dockTitle.x + geometry.dockTitle.width + 4).toBeLessThanOrEqual(toggle.x);
              expect(toggle.width).toBeGreaterThanOrEqual(44);
              expect(toggle.height).toBeGreaterThanOrEqual(44);
              await page.locator("button[data-seat-user-id]").last().click({ trial: true });
            }
            expect(geometry.overflow).toBeLessThanOrEqual(viewport.width);
            expect(errors).toEqual([]);
          } finally {
            await page.close();
          }
        });
      }
    }
  }
});
