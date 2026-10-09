import { expect, test, type Page } from "playwright/test";
import sharp from "sharp";
import { loadedEnvironment, observePlayEnvironmentResources, playEnvironmentDiagnostics } from "./play-environment-resources";

test.use({ trace: "retain-on-failure" });
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await observePlayEnvironmentResources(page);
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    const diagnostics = await playEnvironmentDiagnostics(page).catch((error: Error) => ({ error: error.message }));
    await info.attach("environment-resource-timing", { body: JSON.stringify(diagnostics), contentType: "application/json" });
  }
  expect(runtimeErrors.get(page)).toEqual([]);
  await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
});

const phases = [
  "lobby", "role_reveal", "first_night", "night", "day_announcement", "day_discussion",
  "nomination", "defense", "voting", "resolution", "hunter_revenge", "mayor_successor", "paused", "game_over",
] as const;
const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
];

type Viewport = { width: number; height: number };

async function expectEnvironment(page: Page, viewport: Viewport, family: string, theme: string, phase: string) {
  const shell = page.locator(phase === "game_over" ? "main.play-finale-shell:visible" : "main.play-shell:visible");
  const stage = page.locator(".play-stage:visible");
  if (phase === "game_over") {
    await expect(shell).toHaveAttribute("data-phase", "game_over");
    await expect(page.locator(".play-stage, .play-primary-column, .play-action-dock")).toHaveCount(0);
    const conclusion = shell.locator("[data-endgame]");
    const winnerTeam = family === "mafia" ? "mafia" : "village";
    await expect(conclusion).toHaveAttribute("data-endgame", winnerTeam);
    const scene = conclusion.locator('section[aria-labelledby="conclusion-heading"]');
    const backdrop = scene.locator(':scope > img[src$=".webp"]').first();
    const winnerArt = `/game-art/endgame/${winnerTeam}-v1.webp`;
    await expect(backdrop).toHaveAttribute("alt", "");
    await expect.poll(async () => (await loadedEnvironment(backdrop, null)).path).toBe(winnerArt);
    const winner = await loadedEnvironment(backdrop, null);
    expect(winner.imageWidth).toBeGreaterThan(winner.imageHeight);
    expect(winner.imageHeight).toBeGreaterThan(0);
    expect(winner.filter).toBe("none");
    expect(winner.objectFit).toBe("cover");
    expect(Math.max(winner.width / winner.imageWidth, winner.height / winner.imageHeight)).toBeLessThanOrEqual(1.35);
    for (const element of [scene, backdrop]) {
      const box = (await element.boundingBox())!;
      expect(box.x).toBeCloseTo(0, 0);
      expect(box.width).toBeCloseTo(viewport.width, 0);
    }
    await expect(scene.getByRole("heading", { level: 1, name: family === "mafia" ? "Мафията победи" : "Селото победи", exact: true })).toBeVisible();
    await expect(scene.getByRole("link", { name: "Още една игра", exact: true })).toBeVisible();
    await expect(scene.getByRole("link", { name: "Към архива", exact: true })).toHaveAttribute("href", "/history");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    return winner;
  }

  const lobby = phase === "lobby";
  const target = lobby ? shell : page.locator(".play-primary-column:visible");
  const pseudo = lobby ? "::before" : null;
  const expected = `/game-art/lobby/waiting-${family}-${theme}-v1.webp`;
  await expect(stage).toHaveAttribute("data-layout-ready", "true");
  await expect.poll(async () => (await loadedEnvironment(target, pseudo)).path).toBe(expected);
  const scene = await loadedEnvironment(target, pseudo);
  expect(scene.imageWidth).toBeGreaterThan(scene.imageHeight);
  expect(scene.imageHeight).toBeGreaterThan(0);
  expect(scene.filter, "The room artwork must not be blurred").toBe("none");
  // The last layer is the room image; a full-size gradient may use default repeat.
  expect(scene.backgroundRepeat.split(",").at(-1)?.trim()).toBe("no-repeat");
  expect(scene.backgroundAttachment.split(",").every((attachment) => attachment.trim() === "scroll")).toBe(true);
  expect(scene.position).toBe(lobby ? "absolute" : "static");
  expect(await shell.evaluate((element) => getComputedStyle(element, "::before").content)).toBe(lobby ? '\"\"' : "none");

  // Waiting compositions have a fixed-height mobile crop, not cover over the
  // entire column (which also holds controls). Measure the actual painted art.
  let scale: number;
  let paintedHeight: number;
  let artTop = 0;
  if (viewport.width <= 1365) {
    paintedHeight = lobby ? 800 : viewport.width <= 1023 ? 780 : 850;
    expect(scene.backgroundSize).toBe(`auto ${paintedHeight}px`);
    expect(scene.backgroundPosition).toBe("50% 0%");
    scale = paintedHeight / scene.imageHeight;
  } else {
    expect(scene.backgroundSize).toContain("min(100%, 1780px)");
    if (lobby) {
      expect(scene.backgroundPosition).toBe("0% 0%, 50% 0%");
    } else {
      const compactOval = viewport.height <= 960 && await stage.getAttribute("data-layout-mode") === "active-table";
      // Measure the room's own --play-compact-height instead of restating its clamp here.
      const compactHeight = await shell.evaluate((element) => {
        const probe = document.createElement("div");
        probe.style.cssText = "position:absolute;visibility:hidden;height:var(--play-compact-height)";
        element.append(probe);
        const height = probe.getBoundingClientRect().height;
        probe.remove();
        return height;
      });
      artTop = compactOval
        ? -64 - (Math.min(viewport.width * 0.47478, 845) - compactHeight) * 0.65
        : -64;
      expect(scene.backgroundPosition.split(" ")[0]).toBe("50%");
      expect(Number.parseFloat(scene.backgroundPosition.split(" ")[1]!)).toBeCloseTo(artTop, 2);
    }
    scale = Math.min(scene.width, 1780) / scene.imageWidth;
    paintedHeight = scene.imageHeight * scale;
  }
  expect(scale, "Room art must retain the existing 1.35x maximum upscale").toBeLessThanOrEqual(1.35);
  expect(scene.imageWidth * scale, "The room crop must fill the viewport width").toBeGreaterThanOrEqual(viewport.width - 1);
  await expect(stage).toHaveAttribute("data-layout-ready", "true");
  await expect(stage).toHaveCSS("background-image", "none");
  await expect(stage).toHaveCSS("filter", "none");
  const stageBox = (await stage.boundingBox())!;
  expect(stageBox.x).toBeCloseTo(0, 0);
  expect(stageBox.width).toBeCloseTo(viewport.width, 0);
  if (!lobby) {
    await expect(stage).toHaveCSS("border-top-width", "0px");
    await expect(stage).toHaveCSS("border-radius", "0px");
    expect(paintedHeight + artTop, "Room art must reach the end of the active table").toBeGreaterThanOrEqual(stageBox.height - 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  return scene;
}

for (const scenario of [
  { family: "werewolves", theme: "light", viewport: { width: 390, height: 844 } },
  { family: "mafia", theme: "dark", viewport: { width: 1440, height: 900 } },
] as const) {
  test(`endgame environment native scene ${scenario.family} ${scenario.theme} ${scenario.viewport.width}`, async ({ page }) => {
    await page.setViewportSize(scenario.viewport);
    await page.emulateMedia({ colorScheme: scenario.theme, reducedMotion: "reduce" });
    await page.addInitScript((theme) => {
      localStorage.setItem("werewolf-theme", theme);
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    }, scenario.theme);
    await page.goto(`/play/VISUAL?visualGame=1&family=${scenario.family}&phase=game_over&players=10`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", scenario.theme);
    await expectEnvironment(page, scenario.viewport, scenario.family, scenario.theme, "game_over");
  });
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const viewport of viewports) {
      test(`play environment ${family} ${theme} ${viewport.width}`, async ({ page }, info) => {
        test.setTimeout(180_000);
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        const testedPhases = viewport.width === 768 || viewport.width === 844
          ? ["day_discussion", "night", "paused"] as const
          : phases;
        for (const phase of testedPhases) {
          await test.step(phase, async () => {
            await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=${phase}&players=10&viewer=host`);
            const shell = page.locator(phase === "game_over" ? "main.play-finale-shell:visible" : "main.play-shell:visible");
            await expect(shell).toHaveAttribute("data-phase", phase);
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(shell.locator("h1").first()).toBeVisible();
            await expect(page).toHaveURL(/\/play\/VISUAL/);
            expect(await page.title()).not.toBe("");
            const outer = await expectEnvironment(page, viewport, family, theme, phase);
            await info.attach(`${phase}-environment`, { body: JSON.stringify(outer), contentType: "application/json" });
            if (phase === "night" || phase === "day_discussion") {
              await page.evaluate(() => document.fonts.ready);
              await expect(page.locator("[data-private-dossier]")).toBeVisible();
              await expect(page.locator(".play-personal-loading:visible")).toHaveCount(0);
              await page.screenshot({ path: info.outputPath(`${phase}.png`), animations: "disabled" });
            }
          });
        }
      });
    }

    test(`play environment remains visible and interactive ${family} ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=night&players=9&role=${family === "mafia" ? "commissioner" : "seer"}`);
      const viewport = { width: 390, height: 844 };
      const initial = await expectEnvironment(page, viewport, family, theme, "night");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("[data-private-dossier]")).toBeVisible();
      await expect(page.locator(".play-personal-loading:visible")).toHaveCount(0);
      const visible = await page.screenshot({ path: info.outputPath("night-visible.png"), animations: "disabled" });
      const hideArt = await page.addStyleTag({ content: ".play-primary-column { background-image: none !important; }" });
      const hidden = await page.screenshot({ animations: "disabled" });
      await hideArt.evaluate((element) => element.parentNode?.removeChild(element));
      const pixels = await sharp(visible).removeAlpha().raw().toBuffer();
      const hiddenPixels = await sharp(hidden).removeAlpha().raw().toBuffer();
      let changed = 0;
      for (let index = 0; index < pixels.length; index += 3) {
        if (Math.abs(pixels[index]! - hiddenPixels[index]!) + Math.abs(pixels[index + 1]! - hiddenPixels[index + 1]!) + Math.abs(pixels[index + 2]! - hiddenPixels[index + 2]!) > 6) changed++;
      }
      expect(changed / (pixels.length / 3), "The active room must contribute visible pixels").toBeGreaterThan(0.01);
      const hideAtmosphere = await page.addStyleTag({ content: '.play-stage > [aria-hidden="true"] { visibility: hidden !important; }' });
      const withoutAtmosphere = await page.screenshot({ animations: "disabled" });
      await hideAtmosphere.evaluate((element) => element.parentNode?.removeChild(element));
      const atmospherePixels = await sharp(withoutAtmosphere).removeAlpha().raw().toBuffer();
      let atmosphereDelta = 0;
      for (let index = 0; index < pixels.length; index++) {
        atmosphereDelta += Math.abs(pixels[index]! - atmospherePixels[index]!);
      }
      expect(atmosphereDelta / pixels.length, "Atmosphere must not wash over the room artwork").toBeLessThan(3);
      const seat = page.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first();
      await seat.click();
      await expect(seat).toHaveAttribute("aria-pressed", "true");
      const beforeScroll = await page.locator(".play-primary-column").evaluate((element) => ({ top: element.getBoundingClientRect().top + scrollY, scroll: scrollY }));
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeScroll.scroll + 50);
      const scrolled = await expectEnvironment(page, viewport, family, theme, "night");
      const afterScroll = await page.locator(".play-primary-column").evaluate((element) => element.getBoundingClientRect().top + scrollY);
      expect(afterScroll).toBeCloseTo(beforeScroll.top, 0);
      expect(scrolled.path).toBe(initial.path);
      expect(scrolled.height).toBe(initial.height);
      expect(scrolled.backgroundPosition).toBe(initial.backgroundPosition);
      expect(scrolled.backgroundSize).toBe(initial.backgroundSize);
    });

    for (const viewport of viewports.slice(0, 2)) {
      test(`play room fills the active scene without an exterior scrim ${family} ${theme} ${viewport.width}`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        for (const phase of ["voting", "night"]) {
          await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=${phase}&players=12&viewer=host`);
          await expectEnvironment(page, viewport, family, theme, phase);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator("[data-private-dossier]")).toBeVisible();
          await expect(page.locator(".play-personal-loading:visible")).toHaveCount(0);
          const stage = (await page.locator(".play-stage:visible").boundingBox())!;
          const clip = {
            x: Math.ceil(stage.x), y: Math.ceil(Math.max(stage.y, 64)),
            width: Math.floor(stage.width), height: Math.floor(Math.min(stage.y + stage.height, viewport.height - 96) - Math.max(stage.y, 64)),
          };
          expect(clip.height, "The first viewport must reveal a meaningful part of the room").toBeGreaterThan(160);
          const visible = await page.screenshot({ path: info.outputPath(`${phase}-room.png`), clip, animations: "disabled" });
          const clearScrim = await page.addStyleTag({ content: "main.play-shell { --play-body-scrim: linear-gradient(transparent, transparent) !important; --play-body-glow: none !important; }" });
          const unmuted = await page.screenshot({ clip, animations: "disabled" });
          await clearScrim.evaluate((element) => element.parentNode?.removeChild(element));
          const stagePixels = await sharp(visible).removeAlpha().raw().toBuffer();
          const unmutedStagePixels = await sharp(unmuted).removeAlpha().raw().toBuffer();
          expect(stagePixels.equals(unmutedStagePixels), "The retired outer scrim must not tint the active room").toBe(true);
          const hideArt = await page.addStyleTag({ content: ".play-primary-column { background-image: none !important; }" });
          const hidden = await sharp(await page.screenshot({ clip, animations: "disabled" })).removeAlpha().raw().toBuffer();
          await hideArt.evaluate((element) => element.parentNode?.removeChild(element));
          let changed = 0;
          for (let index = 0; index < stagePixels.length; index += 3) {
            if (Math.abs(stagePixels[index]! - hidden[index]!) + Math.abs(stagePixels[index + 1]! - hidden[index + 1]!) + Math.abs(stagePixels[index + 2]! - hidden[index + 2]!) > 6) changed++;
          }
          const visibleArtRatio = changed / (stagePixels.length / 3);
          expect(visibleArtRatio, "Room artwork must visibly occupy the scene, not a small framed inset").toBeGreaterThan(0.1);
          const stats = await sharp(await sharp(visible).greyscale().toBuffer()).stats();
          expect(stats.channels[0]!.stdev, "The room must retain visible tonal detail").toBeGreaterThan(12);
          await info.attach(`${phase}-scene-pixels`, { body: JSON.stringify({ visibleArtRatio, luminanceStdev: stats.channels[0]!.stdev }), contentType: "application/json" });
        }
      });
    }
  }
}
