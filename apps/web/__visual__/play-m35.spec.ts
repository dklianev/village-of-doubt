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
const BOUNDARY_COUNTS = [3, 6, 7, 9, 10, 13, 14, 18, 19, 24, 30] as const;
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
  { phase: "voting", family: "werewolves", players: 30, voteTally: "full" },
] as const;

for (const [index, scenario] of GATE_SCENARIOS.entries()) {
  test(`@play-gate geometry ${scenario.family} ${scenario.phase} ${scenario.players}`, async ({ page }) => {
    const viewport = MATRIX_VIEWPORTS[index % MATRIX_VIEWPORTS.length]!;
    await openFixture(page, scenario, index % 2 === 0 ? "dark" : "light", viewport);
    await expectGeometry(page);
  });
}

for (const [name, viewport] of [
  ["desktop", MATRIX_VIEWPORTS[7]],
  ["mobile", MATRIX_VIEWPORTS[1]],
] as const) {
  test(`@play-gate timer tally stays fully visible ${name}`, async ({ page }) => {
    await openFixture(page, { phase: "night", family: "werewolves", players: 12, dead: 1 }, "dark", viewport);
    await expect(page.getByText("11 живи · 1 елиминиран", { exact: true })).toBeVisible();
    await expectGeometry(page);
  });
}

test("@play-gate mobile stage ledger labels remain complete", async ({ page }) => {
  await openFixture(page, { phase: "resolution", family: "mafia", players: 10, dead: 2 }, "dark", MATRIX_VIEWPORTS[1]);
  await expectGeometry(page);
});

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

for (const theme of THEMES) {
  test(`@play-gate axe mobile day rail ${theme}`, async ({ page }) => {
    await openFixture(
      page,
      { phase: "day_discussion", family: "werewolves", players: 8 },
      theme,
      MATRIX_VIEWPORTS[1],
    );
    await page.getByText("Правила и подсказки", { exact: true }).click();
    await page.getByRole("tab", { name: "Чат" }).click();

    const accessibility = await new AxeBuilder({ page })
      .include(".play-side-rail")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(accessibility.incomplete.filter((result) => result.id !== "color-contrast")).toEqual([]);

    const tabColors = await page.locator(".play-rail-tabs").evaluate((tabs) => ({
      background: getComputedStyle(tabs).backgroundColor,
      labels: [...tabs.querySelectorAll<HTMLElement>(".play-rail-tab")].map((tab) => getComputedStyle(tab).color),
    }));
    if (theme === "light") {
      expect(tabColors.background).toBe("rgb(243, 229, 201)");
      expect(tabColors.labels).toEqual(["rgb(74, 47, 28)", "rgb(255, 250, 240)"]);
    }
  });
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

test("@play-interaction mobile host menus stay inside the stage and restore focus", async ({ page }) => {
  await openFixture(page, { phase: "lobby", family: "werewolves", players: 18, viewer: "host" }, "light", MATRIX_VIEWPORTS[1]);
  const stage = page.locator(".play-stage");
  const triggers = page.locator("[data-seat-menu-trigger]");
  const triggerIndexes = [0, Math.max(0, await triggers.count() - 1)];

  for (const index of triggerIndexes) {
    const trigger = triggers.nth(index);
    await trigger.click();
    const menu = page.locator("[data-seat-menu-root][data-open=\"true\"] [role=\"group\"]");
    await expect(menu).toBeVisible();
    const [stageBox, menuBox] = await Promise.all([stage.boundingBox(), menu.boundingBox()]);
    expect(stageBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(stageBox!.x - 1);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width + 1);
    const action = menu.getByRole("button").first();
    await action.click();
    await expect(trigger).toBeFocused();
  }
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
  const resetTarget = page.getByRole("button", { name: "Промени първата цел" });
  await expect(resetTarget).toBeVisible();
  await expect(page.getByRole("button", { name: "Изкови меч" })).toBeEnabled();
  await resetTarget.click();
  await expect(page.getByRole("button", { name: "Покажи личния ход" })).toBeFocused();
});

test("@play-interaction short mobile dock keeps its controls reachable", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 600 }, { width: 844, height: 390 }]) {
    await openFixture(page, { phase: "night", family: "mafia", players: 8, role: "doctor" }, "dark", viewport);
    await expandMobileDock(page);

    const dock = page.locator(".play-action-dock");
    const dossier = page.getByRole("button", { name: "Отвори тайното досие" });
    const collapse = page.getByRole("button", { name: "Скрий личния ход" });
    const [dockBox, dossierBox, collapseBox] = await Promise.all([
      dock.boundingBox(),
      dossier.boundingBox(),
      collapse.boundingBox(),
    ]);
    expect(dockBox).not.toBeNull();
    expect(dossierBox).not.toBeNull();
    expect(collapseBox).not.toBeNull();
    expect(dockBox!.y).toBeGreaterThanOrEqual(0);
    expect(dossierBox!.y).toBeGreaterThanOrEqual(dockBox!.y);
    expect(collapseBox!.y).toBeGreaterThanOrEqual(dockBox!.y);
    expect(dossierBox!.y + dossierBox!.height).toBeLessThanOrEqual(viewport.height);
    expect(collapseBox!.y + collapseBox!.height).toBeLessThanOrEqual(viewport.height);

    await dock.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(dossier).toBeInViewport();
    await expect(collapse).toBeInViewport();
  }
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

test("@play-interaction chronicle tabs expose a writable day chat", async ({ page }) => {
  await openFixture(page, { phase: "day_discussion", family: "werewolves", players: 8 }, "dark", MATRIX_VIEWPORTS[6]);
  const chatTab = page.getByRole("tab", { name: "Чат" });
  await chatTab.click();
  await expect(chatTab).toHaveAttribute("aria-selected", "true");
  const composer = page.getByPlaceholder("Напиши обвинение, защита или блъф...");
  await composer.fill("Подозирам играча срещу мен.");
  await expect(composer).toHaveValue("Подозирам играча срещу мен.");
  await expect(page.getByRole("button", { name: "Изпрати" })).toBeEnabled();
});

test("@play-gate initial stage layout stays stable", async ({ page }) => {
  await openFixture(page, { phase: "night", family: "werewolves", players: 8 }, "dark", MATRIX_VIEWPORTS[1]);
  await page.addInitScript(() => {
    (window as Window & { __playCls?: number }).__playCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
        sources?: Array<{ node?: Node | null }>;
      }>) {
        const touchesPlayShell = entry.sources?.some(({ node }) => (
          node instanceof Element && Boolean(node.closest(".play-shell"))
        ));
        if (!entry.hadRecentInput && touchesPlayShell) {
          const target = window as Window & { __playCls?: number };
          target.__playCls = (target.__playCls ?? 0) + (entry.value ?? 0);
        }
      }
    }).observe({ type: "layout-shift" });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForStableStage(page);
  await page.waitForTimeout(400);
  const cls = await page.evaluate(() => (window as Window & { __playCls?: number }).__playCls ?? 0);
  expect(cls).toBeLessThan(0.02);
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
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true", {
    timeout: 30_000,
  });

  await page.waitForFunction(() => {
    const readSignature = () => {
      const stage = document.querySelector<HTMLElement>(".play-stage");
      const scene = document.querySelector<HTMLElement>("[data-table-scene]");
      const seats = [...document.querySelectorAll<HTMLElement>(".play-seat-slot")];
      if (!stage || !scene || seats.length === 0) {
        return "";
      }
      if (stage.dataset.layoutReady !== "true") {
        return "";
      }
      const expectsMobileGrid = window.matchMedia("(max-width: 1023px)").matches;
      if (expectsMobileGrid && stage.dataset.layoutMode !== "mobile-table-grid") {
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
    };

    const signature = readSignature();
    if (!signature) {
      return false;
    }
    const target = window as Window & {
      __playStableSignature?: string;
      __playStableSince?: number;
    };
    if (target.__playStableSignature !== signature) {
      target.__playStableSignature = signature;
      target.__playStableSince = performance.now();
      return false;
    }
    return performance.now() - (target.__playStableSince ?? performance.now()) >= 120;
  }, undefined, { timeout: 30_000, polling: 16 });
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
    const timer = core.querySelector<HTMLElement>("[role=\"timer\"]");
    const counts = core.querySelector<HTMLElement>(":scope > span:last-child");
    const countsRect = counts?.getBoundingClientRect();
    if (counts) {
      if (counts.scrollWidth > counts.clientWidth + 1 || counts.scrollHeight > counts.clientHeight + 1) {
        violations.push("table-counts-clipped");
        diagnostics.push(`table counts clipped: ${JSON.stringify({
          clientWidth: counts.clientWidth,
          scrollWidth: counts.scrollWidth,
          clientHeight: counts.clientHeight,
          scrollHeight: counts.scrollHeight,
        })}`);
      }
      if (timer && overlapArea(timer.getBoundingClientRect(), counts.getBoundingClientRect()) > 4) {
        violations.push("timer-overlaps-counts");
      }
      if (
        countsRect &&
        (countsRect.left < stageRect.left - 1 || countsRect.right > stageRect.right + 1 || countsRect.top < stageRect.top - 1 || countsRect.bottom > stageRect.bottom + 1)
      ) {
        violations.push("table-counts-outside-stage");
      }
    }
    for (const label of core.closest<HTMLElement>(".play-stage")?.querySelectorAll<HTMLElement>("[data-stage-ledger] span") ?? []) {
      if (label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1) {
        violations.push("stage-ledger-label-clipped");
        diagnostics.push(`stage ledger label clipped: ${JSON.stringify({
          text: label.textContent?.trim(),
          clientWidth: label.clientWidth,
          scrollWidth: label.scrollWidth,
          clientHeight: label.clientHeight,
          scrollHeight: label.scrollHeight,
        })}`);
      }
    }
    const dock = document.querySelector<HTMLElement>(".play-action-dock");
    const dockRect = dock?.getBoundingClientRect();
    if (window.innerWidth >= 1024 && dockRect && overlapArea(stageRect, dockRect) > 4) {
      violations.push("stage-overlaps-dock");
      diagnostics.push(`stage overlaps dock: ${JSON.stringify({
        stage: stageRect.toJSON(),
        dock: dockRect.toJSON(),
      })}`);
    }
    for (const panel of document.querySelectorAll<HTMLElement>(".ritual-panel, .night-action-sheet")) {
      const targets = panel.querySelector<HTMLElement>(".play-selected-targets, :scope > .play-selected-target");
      const actions = panel.querySelector<HTMLElement>(".play-action-buttons");
      if (targets && actions && overlapArea(targets.getBoundingClientRect(), actions.getBoundingClientRect()) > 4) {
        violations.push("action-target-overlap");
        diagnostics.push(`action target overlaps controls: ${JSON.stringify({
          targets: targets.getBoundingClientRect().toJSON(),
          actions: actions.getBoundingClientRect().toJSON(),
        })}`);
      }
    }
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
      if (countsRect && overlapArea(rect, countsRect) > 4) {
        violations.push("seat-overlaps-counts");
        diagnostics.push(`seat ${index} overlaps table counts: ${JSON.stringify(rect.toJSON())}`);
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
    if (window.innerWidth >= 1024) {
      for (const selector of [".play-action-dock", ".play-side-rail", ".play-rail-guide-body"]) {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) {
          continue;
        }
        const style = getComputedStyle(element);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1) {
          violations.push(`nested-scroll:${selector}`);
        }
      }
    }
    for (const selector of [
      ".night-action-help",
      ".night-action-server-note",
      ".role-card-body > p",
      ".play-stage-takeover .post-game-story ol",
    ]) {
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        const style = getComputedStyle(element);
        if (style.display !== "none" && style.overflowY !== "visible" && element.scrollHeight > element.clientHeight + 1) {
          violations.push(`text-clipped:${selector}`);
        }
      }
    }
    return {
      fatal: "",
      violations: [...new Set(violations)],
      diagnostics,
      layout: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        mode: stage.dataset.layoutMode,
        ready: stage.dataset.layoutReady,
        stageClass: stage.className,
        firstSeat: seats[0]
          ? {
              className: seats[0].className,
              inlineStyle: seats[0].getAttribute("style"),
              position: getComputedStyle(seats[0]).position,
              top: getComputedStyle(seats[0]).top,
              left: getComputedStyle(seats[0]).left,
              transform: getComputedStyle(seats[0]).transform,
            }
          : null,
      },
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
