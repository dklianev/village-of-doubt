import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { act, cleanup, render } from "@testing-library/react";
import { chromium } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { GamePhase } from "@werewolf/shared";
import type { PublicPlayer } from "@/lib/play/types";

const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve("vitest/package.json"))("lightningcss");
const css = ["play/PlayStage", "play/PlaySeat", "play/Timer", "ProfilePortrait"].map(name => {
  const filename = resolve(process.cwd(), `components/${name}.module.css`);
  const compiled = transform({ filename, code: readFileSync(filename), cssModules: true });
  vi.doMock(filename, () => ({ default: Object.fromEntries(
    Object.entries(compiled.exports as Record<string, { name: string }>).map(([key, value]) => [key, value.name]),
  ) }));
  return compiled.code.toString();
}).join("\n");
const { PlayStage } = await import("@/components/play/PlayStage");
const fonts = [["Literata", "literata-reading"], ["Sofia", "sofia-sans-interface"]].map(([family, file]) =>
  `@font-face { font-family: ${family}; src: url(data:font/woff2;base64,${readFileSync(resolve(process.cwd(), `app/fonts/${file}.woff2`)).toString("base64")}); font-weight: 400 700; }`,
).join("\n");
const artifacts = process.env.ACTIVE_STAGE_ARTIFACT_DIR;
let browser: Awaited<ReturnType<typeof chromium.launch>>;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function markup(width: number, height: number, count: number, family: "werewolves" | "mafia", phase: GamePhase = "voting") {
  let callback: ResizeObserverCallback | undefined;
  vi.stubGlobal("ResizeObserver", class {
    constructor(cb: ResizeObserverCallback) { callback = cb; }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const compact = width >= 1024 && height <= 960;
  const crowded = width >= 1024 && count > 12 && width * 0.88 / (Math.ceil(count / 2) - 1) >= 78;
  const sceneHeight = crowded ? (compact ? 114 : 149) + 16 + 390
    : compact && width >= 1366 && count <= 12 ? Math.max(380, Math.min(550, height - 390)) : width * 706 / 1487;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("960") ? width >= 1366 && compact : query.includes("1366") ? width >= 1366 : width <= 1023 }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(sceneHeight);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return new DOMRect(0, 0, width, this.hasAttribute("data-stage-hud") ? compact ? 114 : 149 : sceneHeight);
  });
  const names = ["Искра", "Борис", "Рада", "Елена", "Неда", "Велин", "Димо", "Яна"];
  const players: PublicPlayer[] = Array.from({ length: count }, (_, i) => ({
    userId: `synthetic-${i}`, displayName: names[i] ?? `Играч ${i + 1}`,
    avatarId: `portrait-${i % 2 ? "m" : "f"}0${1 + i % 5}`,
    connected: true, ready: true, playing: true, alive: i !== 3,
    host: false, narrator: false, acceptedFullNarrator: false, mayor: false,
    hasVoted: false, actedThisPhase: false, revealedRole: "",
  }));
  const { container } = render(<PlayStage code="ABC234" phase={phase}
    family={family} mode={family === "mafia" ? "mafia_free" : "werewolves_classic"}
    round={2} phaseEndsAt={0} isPending={false} players={players} hasSnapshot
    narratorMode="automatic" communicationMode="built_in_chat" ownPlayer={players[0]}
    targetableIds={new Set(players.filter(p => p.alive).map(p => p.userId))}
    shortcutNumbers={new Map()} selectedTargetId="synthetic-1" secondTargetId=""
    voteCounts={new Map()} currentSpeakerUserId="" currentDefenseUserId="" nomineeIds={new Set()}
    onSelectSeat={() => {}} onMakeNarrator={() => {}} onMakeMayor={() => {}}
  />);
  act(() => callback?.([], {} as ResizeObserver));
  return container.innerHTML;
}

describe("active stage rendered geometry", () => {
  for (const family of ["werewolves", "mafia"] as const) {
    for (const theme of ["dark", "light"] as const) {
      it.each([
        { width: 320, height: 568, count: 8 }, { width: 390, height: 844, count: 12 }, { width: 768, height: 1024, count: 30 },
        { width: 1366, height: 768, count: 8 }, { width: 1366, height: 768, count: 16 },
        { width: 1280, height: 720, count: 12 }, { width: 1366, height: 768, count: 12 },
        { width: 1344, height: 900, count: 8, phase: "day_discussion" as const },
        { width: 1440, height: 900, count: 10, phase: "night" as const },
        { width: 1440, height: 900, count: 8 }, { width: 1440, height: 900, count: 12 },
        { width: 1487, height: 1058, count: 8 }, { width: 1487, height: 1058, count: 12 }, { width: 1487, height: 1058, count: 30 },
      ])(`${family} ${theme} at $width x $height with $count seats stays frameless and readable`, async ({ width, height, count, phase }) => {
        const html = markup(width, height, count, family, phase);
        const page = await browser.newPage({ viewport: { width, height } });
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        try {
          await page.route("https://active-stage.test/**", async route => {
            const url = new URL(route.request().url());
            const asset = url.pathname === "/_next/image" ? url.searchParams.get("url")! : url.pathname;
            const root = resolve(process.cwd(), "public");
            const path = resolve(root, `.${asset}`);
            if (!path.startsWith(`${root}/`) && !path.startsWith(`${root}\\`)) return route.abort();
            try { await route.fulfill({ path }); } catch { await route.abort(); }
          });
          await page.setContent(`<html data-theme="${theme}"><head><base href="https://active-stage.test/"><style>
            ${fonts} ${css}
            * { box-sizing: border-box; }
            body { margin: 0; font: 16px/1.5 Sofia; color: #fff7df;
              --play-scene-base: ${theme === "dark" ? "#0b1511" : "#e7ede3"};
              --play-scene-ink: ${theme === "dark" ? "#fff7df" : "#172e25"};
              --play-scene-metal: ${theme === "dark" ? "#e6c477" : "#705329"};
              background: var(--play-scene-base) url('/game-art/lobby/waiting-${family}-${theme}-v1.webp') center -64px / 100% auto no-repeat; }
            h1 { font-family: Literata; }
            button { font-family: inherit; }
          </style></head><body>${html}</body></html>`);
          await page.evaluate(() => document.fonts.ready);
          const geometry = await page.evaluate(() => {
            const rect = (el: Element) => {
              const { x, y, width, height } = el.getBoundingClientRect();
              return { x, y, width, height };
            };
            const stage = document.querySelector(".play-stage")!;
            const style = getComputedStyle(stage);
            return { stage: rect(stage), frame: { border: style.borderTopWidth, radius: style.borderRadius, shadow: style.boxShadow },
              mode: stage.getAttribute("data-layout-mode"), overflow: document.documentElement.scrollWidth,
              timer: rect(document.querySelector('[role="timer"]')!),
              seats: [...document.querySelectorAll("[data-seat-token]")].map(rect),
              labels: [...document.querySelectorAll("[data-seat-name], [data-seat-selection], [data-seat-eliminated]")].map(rect),
            };
          });
          if (artifacts) {
            mkdirSync(artifacts, { recursive: true });
            await page.screenshot({ path: join(artifacts, `active-${family}-${theme}-${width}x${height}-${count}.png`), fullPage: true });
          }
          expect(geometry.frame).toEqual({ border: "0px", radius: "0px", shadow: "none" });
          expect(geometry.overflow).toBeLessThanOrEqual(width);
          expect(geometry.mode).toBe(width >= 1024 && count > 12 ? "crowded-table" : width >= 1366 && count <= 12 ? "active-table" : width >= 1024 ? "dense-table-grid" : "mobile-table-grid");
          if (geometry.mode === "crowded-table") expect(geometry.stage.height).toBeLessThanOrEqual(600);
          if (width >= 1024 && height <= 960 && count <= 12) {
            expect(geometry.stage.height).toBeGreaterThanOrEqual(380);
            expect(geometry.stage.height).toBeLessThanOrEqual(550);
            expect(height - 64 - geometry.stage.height).toBeGreaterThanOrEqual(274);
            if (width >= 1366 && count <= 12) expect(height - 64 - geometry.stage.height).toBeGreaterThanOrEqual(324);
          }
          if (width === 1487 && count <= 12) expect(geometry.stage.height).toBe(706);
          expect(await page.getByRole("timer").evaluate(timer => {
            const hud = document.querySelector("[data-stage-hud]")!;
            const scene = document.querySelector("[data-table-scene]")!;
            const washExtension = getComputedStyle(hud, "::before").content === "none" ? 0 : 32;
            return timer.getBoundingClientRect().top >= hud.getBoundingClientRect().bottom + washExtension
              || Number(getComputedStyle(scene).zIndex) > Number(getComputedStyle(hud).zIndex);
          }), "the timer must render above the local header wash").toBe(true);
          expect(geometry.seats).toHaveLength(count);
          const overlaps = (a: typeof geometry.timer, b: typeof geometry.timer) =>
            a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
          for (const [index, seat] of geometry.seats.entries()) {
            expect(seat.width).toBeGreaterThanOrEqual(44);
            expect(seat.height).toBeGreaterThanOrEqual(44);
            expect(seat.x).toBeGreaterThanOrEqual(0);
            expect(seat.x + seat.width).toBeLessThanOrEqual(width);
            expect(seat.y + seat.height).toBeLessThanOrEqual(geometry.stage.height);
            expect(overlaps(seat, geometry.timer), `timer intersects seat ${index}`).toBe(false);
            for (const [offset, other] of geometry.seats.slice(index + 1).entries()) {
              expect(overlaps(seat, other), JSON.stringify({ index, other: index + offset + 1, seat, nextSeat: other })).toBe(false);
            }
          }
          for (const label of geometry.labels) {
            expect(label.x).toBeGreaterThanOrEqual(0);
            expect(label.x + label.width).toBeLessThanOrEqual(width);
          }
          await page.getByRole("button", { name: /Избери Борис/ }).click({ trial: true });
          await page.getByRole("button", { name: /Избери Борис/ }).focus();
          expect(await page.getByRole("button", { name: /Избери Борис/ }).evaluate(el => el === document.activeElement)).toBe(true);
          expect(errors).toEqual([]);
        } finally { await page.close(); }
      });
    }
  }
});
