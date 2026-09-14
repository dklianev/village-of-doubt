import { expect, test, type Page } from "playwright/test";
import sharp from "sharp";
import { loadedEnvironment, observePlayEnvironmentResources, playEnvironmentDiagnostics } from "./play-environment-resources";

test.use({ trace: "retain-on-failure" });
test.beforeEach(async ({ page }) => { await observePlayEnvironmentResources(page); });
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const diagnostics = await playEnvironmentDiagnostics(page).catch((error: Error) => ({ error: error.message }));
  await info.attach("environment-resource-timing", { body: JSON.stringify(diagnostics), contentType: "application/json" });
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

async function expectEnvironment(page: Page, portrait: boolean, family: string, night: boolean) {
  const shell = page.locator("main.play-shell:visible");
  const expected = new RegExp(`^/game-art/${portrait ? "mobile/" : ""}play/bg-play-${family}-${night ? "night" : "day"}-v2\\.(avif|webp)$`);
  await expect.poll(async () => (await loadedEnvironment(shell, "::before")).path).toMatch(expected);
  const outer = await loadedEnvironment(shell, "::before");
  expect(outer.position).toBe("fixed");
  expect(outer.imageWidth).toBeGreaterThan(0);
  expect(outer.imageHeight).toBeGreaterThan(0);
  expect(portrait ? outer.imageHeight > outer.imageWidth : outer.imageWidth > outer.imageHeight).toBe(true);
  expect(Math.max(outer.width / outer.imageWidth, outer.height / outer.imageHeight)).toBeLessThanOrEqual(1.35);
  const stage = page.locator(".play-stage:visible");
  if (await stage.count()) {
    await expect(stage).toHaveAttribute("data-layout-ready", "true");
    await expect.poll(async () => (await loadedEnvironment(stage, null)).path).toBe(outer.path);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  return outer;
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const viewport of viewports) {
      test(`play environment ${family} ${theme} ${viewport.width}`, async ({ page }, info) => {
        test.setTimeout(180_000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        const portrait = viewport.width <= 1023 && viewport.height >= viewport.width;
        const testedPhases = viewport.width === 768 || viewport.width === 844
          ? ["day_discussion", "night", "paused"] as const
          : phases;
        for (const phase of testedPhases) {
          await test.step(phase, async () => {
            await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=${phase}&players=10&viewer=host`);
            await expect(page.locator("main.play-shell:visible")).toHaveAttribute("data-phase", phase);
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(page.locator("main.play-shell:visible h1").first()).toBeVisible();
            await expect(page).toHaveURL(/\/play\/VISUAL/);
            expect(await page.title()).not.toBe("");
            const outer = await expectEnvironment(page, portrait, family, phase === "night" || phase === "first_night");
            await info.attach(`${phase}-environment`, { body: JSON.stringify(outer), contentType: "application/json" });
            if (phase === "night" || phase === "day_discussion") {
              await page.evaluate(() => document.fonts.ready);
              await expect(page.locator(".play-personal-loading:visible")).toHaveCount(0);
              await page.screenshot({ path: info.outputPath(`${phase}.png`), animations: "disabled" });
            }
          });
        }
        expect(errors).toEqual([]);
        await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
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
      const initial = await expectEnvironment(page, true, family, true);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".play-personal-loading:visible")).toHaveCount(0);
      const visible = await page.screenshot({ path: info.outputPath("night-visible.png"), animations: "disabled" });
      const hideArt = await page.addStyleTag({ content: "main.play-shell::before { visibility: hidden !important; }" });
      const hidden = await page.screenshot({ animations: "disabled" });
      await hideArt.evaluate((element) => element.parentNode?.removeChild(element));
      const pixels = await sharp(visible).removeAlpha().raw().toBuffer();
      const hiddenPixels = await sharp(hidden).removeAlpha().raw().toBuffer();
      let changed = 0;
      for (let index = 0; index < pixels.length; index += 3) {
        if (Math.abs(pixels[index]! - hiddenPixels[index]!) + Math.abs(pixels[index + 1]! - hiddenPixels[index + 1]!) + Math.abs(pixels[index + 2]! - hiddenPixels[index + 2]!) > 6) changed++;
      }
      expect(changed / (pixels.length / 3), "Outer scenery must contribute visible pixels").toBeGreaterThan(0.01);
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
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const scrolled = await expectEnvironment(page, true, family, true);
      expect(scrolled.height).toBe(initial.height);
      expect(scrolled.backgroundPosition).toBe(initial.backgroundPosition);
    });

    for (const viewport of viewports.slice(0, 2)) {
      test(`play outer context is quiet without muting the stage ${family} ${theme} ${viewport.width}`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        for (const phase of ["voting", "night"]) {
          await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=${phase}&players=12&viewer=host`);
          const outer = await expectEnvironment(page, viewport.width === 390, family, phase === "night");
          expect(outer.filter, "Quiet exterior must not rely on blurring the art").toBe("none");
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator(".play-personal-loading:visible")).toHaveCount(0);
          const stage = (await page.locator(".play-stage:visible").boundingBox())!;
          // Sample exposed architecture beside the frame and the header inside it.
          const exterior = {
            left: 0, top: Math.ceil(stage.y + 40),
            width: Math.max(1, Math.floor(stage.x / 2)), height: 180,
          };
          const interior = {
            left: Math.ceil(stage.x + 30), top: Math.ceil(stage.y + 30),
            width: Math.floor(Math.min(300, stage.width - 60)), height: 160,
          };
          const visible = await page.screenshot({ path: info.outputPath(`${phase}-quiet.png`), animations: "disabled" });
          const clearScrim = await page.addStyleTag({ content: "main.play-shell { --play-body-scrim: linear-gradient(transparent, transparent) !important; --play-body-glow: none !important; }" });
          const unmuted = await page.screenshot({ animations: "disabled" });
          await clearScrim.evaluate((element) => element.parentNode?.removeChild(element));
          const quietStats = await sharp(await sharp(visible).extract(exterior).greyscale().toBuffer()).stats();
          const unmutedStats = await sharp(await sharp(unmuted).extract(exterior).greyscale().toBuffer()).stats();
          const contrastRatio = quietStats.channels[0]!.stdev / unmutedStats.channels[0]!.stdev;
          expect(contrastRatio, `${phase}: exterior texture should recede behind the framed board`).toBeLessThan(0.55);
          expect(contrastRatio, `${phase}: architecture should remain discernible`).toBeGreaterThan(0.15);
          const stagePixels = await sharp(visible).extract(interior).raw().toBuffer();
          const unmutedStagePixels = await sharp(unmuted).extract(interior).raw().toBuffer();
          expect(stagePixels.equals(unmutedStagePixels), "Outer scrim must leave stage and phase-header pixels unchanged").toBe(true);
          await info.attach(`${phase}-outer-contrast`, { body: JSON.stringify({ contrastRatio }), contentType: "application/json" });
        }
      });
    }
  }
}
