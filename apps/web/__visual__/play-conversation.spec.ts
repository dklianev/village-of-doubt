import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "playwright/test";

async function expectReadableText(locator: Locator) {
  const samples = await locator.evaluateAll((elements) => elements.map((element) => {
    // Let the browser resolve modern CSS colors (including color-mix) into sRGB.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const channels = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [red!, green!, blue!, alpha! / 255];
    };
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const layers: number[][] = [];
    let opaque = false;
    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
      const background = channels(getComputedStyle(parent).backgroundColor);
      layers.unshift(background);
      if ((background[3] ?? 1) === 1) { opaque = true; break; }
    }
    const background = layers.reduce((base, layer) => base.map((channel, index) => (
      layer[index]! * (layer[3] ?? 1) + channel * (1 - (layer[3] ?? 1))
    )), [255, 255, 255]);
    const color = channels(getComputedStyle(element).color);
    const foreground = background.map((channel, index) => color[index]! * (color[3] ?? 1) + channel * (1 - (color[3] ?? 1)));
    const light = luminance(background);
    const ink = luminance(foreground);
    return { text: element.textContent, opaque, contrast: (Math.max(light, ink) + 0.05) / (Math.min(light, ink) + 0.05) };
  }));
  expect(samples.length).toBeGreaterThan(0);
  for (const sample of samples) {
    expect.soft(sample.opaque, `An opaque reading surface behind: ${sample.text}`).toBe(true);
    expect.soft(sample.contrast, `Text contrast: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
  }
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 390, 768, 1023, 1366, 1440]) {
      test(`conversation reading surface ${family} ${theme} ${width}`, async ({ page }, testInfo) => {
        const mobile = width < 1024;
        const height = width === 1366 ? 768 : 900;
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("welcome-modal-shown", "1");
          localStorage.setItem("cookie-consent", "1");
        }, theme);
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=10&voteTally=full`);
        await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (mobile) await page.getByRole("button", { name: "Към разговора", exact: true }).click();

        const rail = page.locator(".play-side-rail");
        const frame = page.locator(".play-interaction-column");
        await expect(rail).toBeVisible();
        const framing = await frame.evaluate((element) => {
          const style = getComputedStyle(element);
          return { radius: parseFloat(style.borderRadius), border: parseFloat(style.borderRightWidth), background: style.backgroundColor };
        });
        expect.soft(framing.radius).toBeGreaterThan(0);
        expect.soft(framing.border).toBeGreaterThan(0);
        expect.soft(framing.background, "The conversation frame needs an opaque surface, not the scene behind it").toMatch(/^rgb\(/);
        expect.soft(await rail.evaluate((element) => parseFloat(getComputedStyle(element).borderTopWidth))).toBe(0);
        await expectReadableText(rail.locator(".event-line"));

        if (mobile) {
          const timer = page.locator(".play-conversation-context [role=timer]");
          await expectReadableText(timer.locator("span, strong"));
          const boxes = await timer.evaluate((element) => {
            const outer = element.getBoundingClientRect();
            const text = [...element.querySelectorAll("span, strong")].flatMap((label) => {
              const range = document.createRange();
              range.selectNodeContents(label);
              return [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
            });
            return { outer: { left: outer.left, right: outer.right, top: outer.top, bottom: outer.bottom }, text };
          });
          for (const box of boxes.text) {
            expect.soft(box.left).toBeGreaterThanOrEqual(boxes.outer.left + 8);
            expect.soft(box.right).toBeLessThanOrEqual(boxes.outer.right - 8);
            expect.soft(box.top).toBeGreaterThanOrEqual(boxes.outer.top + 4);
            expect.soft(box.bottom).toBeLessThanOrEqual(boxes.outer.bottom - 4);
          }
          await expectReadableText(page.locator(".play-conversation-context h1, .play-conversation-context > div > span"));
        }

        const chat = rail.getByRole("tab", { name: "Разговор", exact: true });
        await chat.click();
        await expect(chat).toHaveAttribute("aria-selected", "true");
        await expectReadableText(rail.locator(".chat-line span, .chat-line strong, .play-panel-subhead, .play-muted-note"));
        if (!mobile) {
          const readingArea = await rail.getByRole("tabpanel", { name: "Разговор", exact: true }).boundingBox();
          expect.soft(readingArea!.height, "The chat must not collapse below its status notice").toBeGreaterThanOrEqual(220);
          await expect.soft(rail.locator(".chat-line").first()).toBeInViewport({ ratio: 1 });
        }
        const screenshot = testInfo.outputPath("conversation.png");
        await page.screenshot({ path: screenshot });
        await testInfo.attach("conversation", { path: screenshot, contentType: "image/png" });
        expect.soft(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect.soft(await rail.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        if (width === 390) {
          const accessibility = await new AxeBuilder({ page }).include(".play-interaction-column").withTags(["wcag2a", "wcag2aa"]).analyze();
          expect.soft(accessibility.violations).toEqual([]);
        }
        await chat.press("ArrowLeft");
        await expect(rail.getByRole("tab", { name: "Събития", exact: true })).toBeFocused();
        const events = rail.getByRole("tabpanel", { name: "Събития", exact: true });
        await expect(events).toBeVisible();
        await page.keyboard.press("Tab");
        await expect(events).toBeFocused();
        if (width === 1440 || width === 390) {
          const accessibility = await new AxeBuilder({ page }).include(".play-interaction-column").withTags(["wcag2a", "wcag2aa"]).analyze();
          expect(accessibility.violations).toEqual([]);
        }
        if (mobile) {
          await page.getByRole("button", { name: "Към масата", exact: true }).click();
          await expect(page.locator(".play-stage")).toBeVisible();
          await expect(rail).toBeHidden();
        }
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`compact conversation timer states ${family} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("welcome-modal-shown", "1");
        localStorage.setItem("cookie-consent", "1");
      }, theme);
      const sizes: number[] = [];
      for (const [timerValue, state] of [["90", "running"], ["8", "urgent"], ["0", "finished"]]) {
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=10&timer=${timerValue}`);
        await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
        await page.getByRole("button", { name: "Към разговора", exact: true }).click();
        const timer = page.locator(".play-conversation-context [role=timer]");
        await expect(timer).toHaveAttribute("data-state", state!);
        await expectReadableText(timer.locator("span, strong"));
        const box = (await timer.boundingBox())!;
        sizes.push(box.width);
        expect(box.x).toBeGreaterThan(0);
        expect(box.x + box.width).toBeLessThan(320);
        expect(await timer.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      }
      expect(Math.max(...sizes) - Math.min(...sizes), "Timer states must not resize the header").toBeLessThanOrEqual(1);
    });
  }
}
