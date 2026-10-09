import { expect, test, type Locator, type Page } from "playwright/test";
import sharp from "sharp";

test.use({ serviceWorkers: "block", deviceScaleFactor: 1 });

function luminance(rgb: number[]) {
  return rgb.reduce((sum, value, index) => {
    const channel = value / 255;
    return sum + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      * [0.2126, 0.7152, 0.0722][index]!;
  }, 0);
}

async function expectTextContrast(page: Page, text: Locator) {
  const details = await text.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      label: element.textContent,
      color: style.color,
      large: parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700),
      inline: element.getAttribute("style"),
      clip: { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) },
    };
  });
  const sample = async (color: string) => {
    await text.evaluate((element: HTMLElement, value) => {
      element.style.color = value;
      element.style.textShadow = "none";
    }, color);
    return sharp(await page.screenshot({ clip: details.clip, animations: "disabled" })).removeAlpha().raw().toBuffer();
  };
  let minimum = Infinity;
  let pixels = 0;
  try {
    // Black/white probes locate solid glyphs even when the actual ink matches
    // the artwork. Transparent ink exposes the real composited background.
    const black = await sample("#000");
    const white = await sample("#fff");
    const background = await sample("transparent");
    const foreground = luminance(details.color.match(/[\d.]+/g)!.slice(0, 3).map(Number));
    expect(black.length).toBe(white.length);
    expect(black.length).toBe(background.length);
    for (let index = 0; index < black.length; index += 3) {
      if ([0, 1, 2].some((channel) => white[index + channel]! - black[index + channel]! < 242)) continue;
      const behind = luminance([...background.subarray(index, index + 3)]);
      minimum = Math.min(minimum, (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05));
      pixels++;
    }
  } finally {
    await text.evaluate((element, original) => {
      if (original === null) element.removeAttribute("style");
      else element.setAttribute("style", original);
    }, details.inline);
  }
  expect(pixels, `Solid glyph samples: ${details.label}`).toBeGreaterThan(25);
  expect(minimum, `Contrast over decoded artwork: ${details.label}`).toBeGreaterThanOrEqual(details.large ? 3 : 4.5);
}

for (const theme of ["light", "dark"] as const) {
  for (const scenario of [
    { winner: "village", family: "werewolves" },
    { winner: "village", family: "mafia" },
    { winner: "lovers", family: "werewolves" },
    { winner: "maniac", family: "mafia" },
  ]) {
    test(`endgame text stays readable over art: ${scenario.family} ${scenario.winner} ${theme}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await page.addInitScript((value) => {
        localStorage.setItem("werewolf-theme", value);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      for (const jester of [false, true]) {
        const query = new URLSearchParams({ visualGame: "1", phase: "game_over", ...scenario, players: "6", jesterWin: jester ? "1" : "0" });
        await page.goto(`/play/VISUAL?${query}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.activeElement?.id === "conclusion-heading");
        const scene = page.locator('[data-endgame] section[aria-labelledby="conclusion-heading"]');
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await scene.evaluate(async (element) => {
          await document.fonts.ready;
          for (const image of element.querySelectorAll("img")) await image.decode();
        });
        for (const width of [601, 768, 1280]) {
          await test.step(`${width}px, personal victory ${jester}`, async () => {
            await page.setViewportSize({ width, height: 1000 });
            const copy = scene.locator(":scope > div");
            const text = copy.locator("h1, h2, p");
            for (const element of await text.all()) await expectTextContrast(page, element);
          });
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
