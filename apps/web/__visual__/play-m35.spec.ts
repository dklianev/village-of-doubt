import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "playwright/test";
import knownIssues from "./play-m35-known-issues.json" with { type: "json" };

const PHASES = [
  "lobby",
  "role_reveal",
  "first_night",
  "night",
  "day_announcement",
  "day_discussion",
  "nomination",
  "defense",
  "voting",
  "resolution",
  "hunter_revenge",
  "mayor_successor",
  "paused",
  "game_over",
] as const;

const FAMILIES = ["werewolves", "mafia"] as const;
const THEMES = ["dark", "light"] as const;
const BOUNDARY_COUNTS = [3, 6, 7, 9, 10, 13, 14, 18] as const;
const MATRIX_VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1023, height: 768 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
] as const;

const GATE_SCENARIOS = [
  { phase: "lobby", family: "werewolves", players: 3, viewer: "host" },
  { phase: "first_night", family: "werewolves", players: 6, role: "cupid" },
  { phase: "night", family: "werewolves", players: 9, role: "seer" },
  { phase: "voting", family: "werewolves", players: 13, voteTally: "full" },
  { phase: "lobby", family: "mafia", players: 18, viewer: "host" },
  { phase: "night", family: "mafia", players: 7, role: "commissioner" },
  { phase: "voting", family: "mafia", players: 10, voteTally: "full" },
  { phase: "game_over", family: "mafia", players: 14, winner: "mafia" },
] as const;

for (const [index, scenario] of GATE_SCENARIOS.entries()) {
  test(`@play-gate geometry ${scenario.family} ${scenario.phase} ${scenario.players}`, async ({ page }) => {
    const viewport = MATRIX_VIEWPORTS[index % MATRIX_VIEWPORTS.length]!;
    await openFixture(page, scenario, index % 2 === 0 ? "dark" : "light", viewport);
    await expectGeometry(page);
  });
}

for (const [themeIndex, theme] of THEMES.entries()) {
  for (const family of FAMILIES) {
    test(`@play-gate axe ${family} ${theme}`, async ({ page }) => {
      await openFixture(
        page,
        { phase: "voting", family, players: 10, voteTally: "full" },
        theme,
        MATRIX_VIEWPORTS[themeIndex]!,
      );
      const accessibility = await new AxeBuilder({ page })
        .include(".play-shell")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      expect(accessibility.incomplete.filter((result) => result.id !== "color-contrast")).toEqual([]);
    });
  }
}

for (const [countIndex, players] of BOUNDARY_COUNTS.entries()) {
  for (const [phaseIndex, phase] of PHASES.entries()) {
    for (const [familyIndex, family] of FAMILIES.entries()) {
      for (const [themeIndex, theme] of THEMES.entries()) {
        const caseIndex = (((countIndex * PHASES.length + phaseIndex) * FAMILIES.length + familyIndex) * THEMES.length) + themeIndex;
        if (!belongsToShard(caseIndex)) {
          continue;
        }
        test(`@play-matrix ${players} ${phase} ${family} ${theme}`, async ({ page }) => {
          const viewport = MATRIX_VIEWPORTS[caseIndex % MATRIX_VIEWPORTS.length]!;
          await openFixture(page, { phase, family, players }, theme, viewport);
          await expectGeometry(page);
        });
      }
    }
  }
}

test("@play-interaction voting seat selection and keyboard clear", async ({ page }) => {
  await openFixture(page, { phase: "voting", family: "werewolves", players: 9, voteTally: "full" }, "dark", MATRIX_VIEWPORTS[7]);
  const targets = page.locator(".play-seat-slot[data-targetable=\"true\"] button[data-seat-token]");
  expect(await targets.count()).toBeGreaterThan(0);
  await targets.first().click();
  await expect(targets.first()).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(targets.first()).toHaveAttribute("aria-pressed", "false");
});

test("@play-interaction host menu remains operable", async ({ page }) => {
  await openFixture(page, { phase: "lobby", family: "werewolves", players: 18, viewer: "host" }, "dark", MATRIX_VIEWPORTS[5]);
  const triggers = page.locator("[data-seat-menu-trigger]");
  expect(await triggers.count()).toBeGreaterThan(0);
  await triggers.first().click();
  await expect(page.locator("[data-seat-menu-root][data-open=\"true\"]").first()).toBeVisible();
  if (await triggers.count() > 1) {
    await triggers.nth(1).click();
    await expect(page.locator("[data-seat-menu-root][data-open=\"true\"]")).toHaveCount(1);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-seat-menu-root][data-open=\"true\"]")).toHaveCount(0);
  await expect(triggers.nth(1)).toBeFocused();
});

test("@play-interaction mobile blacksmith completes both target steps", async ({ page }) => {
  await openFixture(page, { phase: "night", family: "werewolves", players: 8, role: "blacksmith" }, "dark", MATRIX_VIEWPORTS[0]);
  const targets = page.locator(".play-seat-slot[data-targetable=\"true\"] button[data-seat-token]");
  expect(await targets.count()).toBeGreaterThan(1);
  await expandMobileDock(page);
  await expect(page.getByText("Стъпка 1 от 2", { exact: true })).toBeVisible();
  await targets.first().click();
  expect(await visibleTargetCount(page)).toBeGreaterThan(0);
  const secondTargets = page.locator(".play-seat-slot[data-targetable=\"true\"] button[data-seat-token]");
  await secondTargets.nth(1).click();
  await expandMobileDock(page);
  await expect(page.getByText("Стъпка 2 от 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Промени първата цел" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Изкови меч" })).toBeEnabled();
});

test("@play-interaction hunter revenge uses the table and keeps the dock reachable", async ({ page }) => {
  await openFixture(page, { phase: "hunter_revenge", family: "werewolves", players: 9, role: "hunter", viewer: "dead" }, "dark", MATRIX_VIEWPORTS[1]);
  const targets = page.locator(".play-seat-slot[data-targetable=\"true\"] button[data-seat-token]");
  expect(await targets.count()).toBeGreaterThan(0);
  await targets.first().click();
  await expandMobileDock(page);
  await expect(page.getByRole("button", { name: /^Застреляй / })).toBeEnabled();
  const dock = page.locator(".play-action-dock");
  await expect(dock).toBeVisible();
  const dockBox = await dock.boundingBox();
  expect(dockBox).not.toBeNull();
  expect(dockBox!.y).toBeLessThan(MATRIX_VIEWPORTS[1].height);
});

test("@play-interaction mobile two-target candidates stay reachable", async ({ page }) => {
  await openFixture(page, { phase: "first_night", family: "werewolves", players: 9, role: "cupid" }, "dark", MATRIX_VIEWPORTS[1]);
  const targets = page.locator(".play-seat-slot[data-targetable=\"true\"] button[data-seat-token]");
  expect(await targets.count()).toBeGreaterThan(1);
  await targets.first().click();
  await expect(targets.first()).toHaveAttribute("aria-pressed", "true");
  expect(await visibleTargetCount(page)).toBeGreaterThan(0);
});

async function openFixture(
  page: Page,
  scenario: Record<string, string | number>,
  theme: "dark" | "light",
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("cookie-consent", "1");
    window.localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
  const query = new URLSearchParams({ visualGame: "1" });
  for (const [key, value] of Object.entries(scenario)) {
    query.set(key, String(value));
  }
  await page.goto(`/play/VISUAL?${query}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".play-stage")).toBeVisible();
  await waitForStableStage(page);
}

async function waitForStableStage(page: Page) {
  let previousSignature = "";
  let stableSamples = 0;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const signature = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".play-stage");
      const scene = document.querySelector<HTMLElement>("[data-table-scene]");
      const seats = [...document.querySelectorAll<HTMLElement>(".play-seat-slot")];
      if (!stage || !scene || seats.length === 0) {
        return "";
      }
      if (stage.dataset.layoutReady !== "true") {
        return "";
      }
      const stageRect = stage.getBoundingClientRect();
      const sceneRect = scene.getBoundingClientRect();
      const firstSeatRect = seats[0]!.getBoundingClientRect();
      return [
        stage.dataset.layoutMode,
        Math.round(stageRect.width),
        Math.round(stageRect.height),
        Math.round(sceneRect.width),
        Math.round(sceneRect.height),
        Math.round(firstSeatRect.x),
        Math.round(firstSeatRect.y),
        seats.length,
      ].join(":");
    });
    stableSamples = signature && signature === previousSignature ? stableSamples + 1 : 0;
    if (stableSamples >= 2) {
      return;
    }
    previousSignature = signature;
    await page.waitForTimeout(90);
  }
  throw new Error("PlayStage не достигна стабилна геометрия.");
}

async function expectGeometry(page: Page) {
  const result = await page.evaluate(({ allowedHitSelectors }) => {
    const stage = document.querySelector<HTMLElement>(".play-stage");
    const core = document.querySelector<HTMLElement>("[data-table-core]");
    const seats = [...document.querySelectorAll<HTMLElement>(".play-seat-slot:not(.play-seat-skeleton)")];
    if (!stage || !core) {
      return { fatal: "Липсва stage или table core", violations: [] as string[] };
    }

    const violations: string[] = [];
    const diagnostics: string[] = [];
    const stageRect = stage.getBoundingClientRect();
    const coreRect = core.getBoundingClientRect();
    const seatRects = seats.map((seat) => ({ seat, rect: seat.getBoundingClientRect() }));
    for (const [index, { rect }] of seatRects.entries()) {
      if (rect.left < stageRect.left - 1 || rect.right > stageRect.right + 1 || rect.top < stageRect.top - 1 || rect.bottom > stageRect.bottom + 1) {
        violations.push("seat-outside-stage");
        diagnostics.push(`seat ${index} outside: ${JSON.stringify(rect.toJSON())}`);
      }
      if (overlapArea(rect, coreRect) > 4) {
        violations.push("seat-overlaps-core");
        diagnostics.push(`seat ${index} overlaps core: ${JSON.stringify(rect.toJSON())}`);
      }
    }
    for (let first = 0; first < seatRects.length; first += 1) {
      for (let second = first + 1; second < seatRects.length; second += 1) {
        if (overlapArea(seatRects[first]!.rect, seatRects[second]!.rect) > 4) {
          violations.push("seat-overlap");
          diagnostics.push(`seats ${first}/${second} overlap`);
        }
      }
    }

    const interactive = [...document.querySelectorAll<HTMLElement>(
      ".play-stage button, .play-stage summary, .play-action-dock button, .play-side-rail button",
    )];
    for (const element of interactive) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }
      if (rect.width < 44 || rect.height < 44) {
        const allowed = allowedHitSelectors.some((selector) => element.matches(selector));
        if (!allowed) {
          violations.push(`small-hit-target:${element.className || element.tagName.toLowerCase()}`);
        }
      }
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      violations.push("horizontal-overflow");
    }
    return {
      fatal: "",
      violations: [...new Set(violations)],
      diagnostics,
      stage: stageRect.toJSON(),
      core: coreRect.toJSON(),
    };

    function overlapArea(first: DOMRect, second: DOMRect) {
      const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
      const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
      return width * height;
    }
  }, { allowedHitSelectors: knownIssues.hitTargetSelectors });

  expect(result.fatal).toBe("");
  expect(result.violations, JSON.stringify(result, null, 2)).toEqual([]);
}

async function visibleTargetCount(page: Page) {
  return page.locator(".play-seat-slot[data-targetable=\"true\"] button[data-seat-token]").evaluateAll((elements) => (
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    }).length
  ));
}

function belongsToShard(caseIndex: number) {
  const shardIndex = Math.max(0, Number(process.env.M35_SHARD_INDEX ?? 0));
  const shardTotal = Math.max(1, Number(process.env.M35_SHARD_TOTAL ?? 1));
  return caseIndex % shardTotal === shardIndex;
}

async function expandMobileDock(page: Page) {
  const collapsedToggle = page.locator(".play-action-dock-toggle[aria-expanded=\"false\"]");
  if (await collapsedToggle.count() > 0) {
    await collapsedToggle.first().click();
  }
}
