import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

const TRANSITIONS = [
  { phase: "night", kind: "night", label: "Нощ", before: "phase-nightfall", after: "phase-moonrise" },
  { phase: "day_announcement", kind: "day", label: "Събуждане", before: "phase-daybreak", after: "phase-sunrise" },
  { phase: "voting", kind: "vote", label: "Гласуване", before: "phase-vote-press", after: null },
  { phase: "resolution", kind: "resolution", label: "Развръзка", before: "phase-ink-bleed", after: null },
  { phase: "role_reveal", kind: "role", label: "Разкриване на роля", before: "phase-sheen", after: null },
] as const;

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 768, 1440]) {
      for (const reducedMotion of ["reduce", "no-preference"] as const) {
        test(`play motion: ${family} ${theme} ${width} ${reducedMotion}`, async ({ page }, testInfo) => {
          const errors: string[] = [];
          const requests: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("request", (request) => requests.push(new URL(request.url()).pathname));
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ reducedMotion, colorScheme: theme });
          await page.addInitScript((theme) => {
            localStorage.setItem("werewolf-theme", theme);
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("welcome-modal-shown", "1");
          }, theme);
          await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=night&players=9`);
          await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page).toHaveTitle(/Сенките/);
          await page.evaluate(() => document.fonts.ready);

          // Present only the transient DOM for CSS inspection. ACK/phase ownership
          // is independently exercised by the hook and orchestrator unit tests.
          await page.locator("main").evaluate((main) => {
            const receipt = document.createElement("div");
            receipt.className = "play-action-receipt";
            receipt.setAttribute("role", "status");
            receipt.setAttribute("aria-live", "polite");
            receipt.textContent = "Нощният ход е приет";
            main.append(receipt);
            for (const animation of receipt.getAnimations()) {
              animation.pause();
              animation.currentTime = 120;
            }
          });
          const overlay = page.locator(".phase-transition-overlay");
          const receipt = page.locator(".play-action-receipt");
          if (reducedMotion === "reduce") {
            expect(await receipt.evaluate((element) => element.getAnimations().length)).toBe(0);
            expect(await page.locator(".play-stage").evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
          } else {
            expect(await receipt.evaluate((element) => element.getAnimations().map((animation) => animation.effect!.getTiming().duration))).toEqual([240]);
          }

          for (const transition of TRANSITIONS) {
            await test.step(`${transition.kind} curtain`, async () => {
              await page.locator("main").evaluate((main, { family, transition }) => {
                const overlay = document.createElement("div");
                overlay.className = `phase-transition-overlay transition-${transition.phase}`;
                overlay.dataset.family = family;
                overlay.dataset.phase = transition.phase;
                overlay.dataset.transitionKind = transition.kind;
                overlay.setAttribute("role", "status");
                overlay.setAttribute("aria-live", "assertive");
                overlay.setAttribute("aria-atomic", "true");
                overlay.innerHTML = '<div><span aria-hidden="true">N</span><strong></strong><small>Разказвачът обръща следващата страница.</small></div>';
                overlay.querySelector("strong")!.textContent = transition.label;
                main.append(overlay);
                for (const animation of overlay.getAnimations({ subtree: true })) {
                  animation.pause();
                  animation.currentTime = 120;
                }
              }, { family, transition });
              const styles = await overlay.evaluate((element) => {
                const style = getComputedStyle(element);
                const before = getComputedStyle(element, "::before");
                const after = getComputedStyle(element, "::after");
                return {
                  pointerEvents: style.pointerEvents,
                  backgroundImage: style.backgroundImage,
                  transform: style.transform,
                  animation: style.animationName,
                  before: { animation: before.animationName, image: before.backgroundImage, transform: before.transform },
                  after: { animation: after.animationName, image: after.backgroundImage },
                };
              });
              expect(styles.pointerEvents).toBe("none");
              expect(styles.backgroundImage).toBe("none");
              expect(styles.transform).toBe("none");
              if (reducedMotion === "reduce") {
                expect(styles.animation).toBe("none");
                expect(styles.before.animation).toBe("none");
                expect(styles.after.animation).toBe("none");
                expect(await overlay.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
                const bounds = await overlay.boundingBox();
                expect(bounds).not.toBeNull();
                expect(bounds!.width).toBe(1);
                expect(bounds!.height).toBe(1);
                await expect(overlay).toHaveCSS("clip-path", "inset(50%)");
                await expect(overlay.locator("small")).toHaveCSS("mask-image", "none");
              } else {
                // CSS Modules scopes keyframe names, so match the stable animation name inside them.
                expect(styles.animation).toContain("phase-curtain");
                expect(styles.before.animation).toContain(transition.before);
                expect(styles.before.image).not.toBe("none");
                if (transition.after) {
                  expect(styles.after.animation).toContain(transition.after);
                  expect(styles.after.image).not.toBe("none");
                } else {
                  expect(styles.after.animation).toBe("none");
                }
                const animations = await overlay.evaluate((element) => element.getAnimations({ subtree: true })
                  .filter((animation): animation is CSSAnimation => animation instanceof CSSAnimation)
                  .map((animation) => animation.animationName));
                expect(animations).toEqual(expect.arrayContaining(
                  ["phase-sigil-in", "phase-title-in", "phase-ink-write"].map((name) => expect.stringContaining(name)),
                ));
                await overlay.evaluate((element) => {
                  for (const animation of element.getAnimations({ subtree: true })) animation.currentTime = 1100;
                });
                await expect(overlay).toHaveCSS("opacity", "1");
                expect(await overlay.evaluate((element) => getComputedStyle(element, "::before").transform))
                  .not.toBe(styles.before.transform);
                const bounds = await overlay.locator("strong").boundingBox();
                expect(bounds).not.toBeNull();
                expect(bounds!.x).toBeGreaterThanOrEqual(0);
                expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
                expect(bounds!.y).toBeGreaterThanOrEqual(0);
                expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
                await overlay.evaluate(async (element) => {
                  for (const animation of element.getAnimations({ subtree: true })) animation.finish();
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                });
                await expect(overlay).toHaveCSS("opacity", "0");
              }
              await overlay.evaluate((element) => element.remove());
            });
          }
          expect(requests.filter((path) => /\/game-art\/(mobile\/)?transition-/.test(path))).toEqual([]);

          await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=game_over&winner=${family}&players=6&jesterWin=1`);
          await page.waitForFunction(() => document.activeElement?.id === "conclusion-heading");
          const finale = page.locator("[data-endgame]");
          await expect(finale).toBeVisible();
          await expect(overlay).toHaveCount(0);
          const heading = finale.locator("h1");
          const art = finale.locator('img[src$="jester-v1.webp"]');
          const actions = finale.locator(".play-winner-actions");
          const before = await actions.boundingBox();
          if (reducedMotion === "reduce") {
            expect(await finale.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
          } else {
            expect(await heading.evaluate((element) => element.getAnimations().map((animation) => animation.effect!.getTiming().duration))).toEqual([420]);
            expect(await art.evaluate((element) => element.getAnimations().map((animation) => animation.effect!.getTiming().delay))).toEqual([120]);
            await finale.evaluate((element) => {
              for (const animation of element.getAnimations({ subtree: true })) {
                animation.pause();
                animation.currentTime = 0;
              }
            });
          }
          const firstLink = actions.getByRole("link").first();
          await expect(firstLink).toBeVisible();
          await firstLink.click({ trial: true });
          await page.keyboard.press("Tab");
          await expect(firstLink).toBeFocused();
          expect(await actions.evaluate((element) => element.getAnimations({ subtree: true })
            .filter((animation) => animation instanceof CSSAnimation).length)).toBe(0);
          expect(await firstLink.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
          await finale.evaluate(async (element) => {
            for (const animation of element.getAnimations({ subtree: true })) animation.finish();
            await document.fonts.ready;
            for (const image of element.querySelectorAll("img")) await image.decode();
          });
          const after = await actions.boundingBox();
          expect(after!.width).toBeCloseTo(before!.width, 0);
          expect(await heading.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
          expect(await heading.evaluate((element) => {
            const transform = getComputedStyle(element).transform;
            return transform === "none" || new DOMMatrix(transform).isIdentity;
          })).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          await page.screenshot({ path: testInfo.outputPath("finale-motion-settled.png"), fullPage: false });
          expect(errors).toEqual([]);
        });
      }
    }
  }
}
