import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";
import sharp from "sharp";

async function expectHeroContrast(page: Page) {
  const selector = ".landing-hero-card > .section-kicker, .landing-title, .landing-hero-copy";
  const lines = await page.locator(selector).evaluateAll((elements) => elements.flatMap((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    const color = Array.from(context.getImageData(0, 0, 1, 1).data);
    return Array.from(range.getClientRects()).map(({ x, y, width, height }) => ({
      x, y, width, height, color,
      text: element.textContent,
      minimum: element.tagName === "H1" ? 3 : 4.5,
    }));
  }));
  // Sample the actual image and scrims beneath the lettering, without changing layout.
  const hidden = await page.addStyleTag({ content: `${selector} { visibility: hidden !important; }` });
  let screenshot: Buffer;
  try {
    screenshot = await page.screenshot({ animations: "disabled", scale: "css" });
  } finally {
    await hidden.evaluate((element) => element.parentNode?.removeChild(element));
  }
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luminance = (rgb: number[]) => {
    const linear = rgb.map((value) => value / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  for (const line of lines) {
    for (const horizontal of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      for (const vertical of [0.2, 0.5, 0.8]) {
        const x = Math.floor(line.x + line.width * horizontal);
        const y = Math.floor(line.y + line.height * vertical);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(info.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(info.height);
        const offset = (y * info.width + x) * info.channels;
        const background = Array.from(data.subarray(offset, offset + 3));
        const alpha = line.color[3]! / 255;
        const foreground = background.map((value, index) => line.color[index]! * alpha + value * (1 - alpha));
        const a = luminance(background);
        const b = luminance(foreground);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `${line.text}: background contrast at ${x},${y}`)
          .toBeGreaterThanOrEqual(line.minimum);
      }
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1366, 768], [1920, 1080]]) {
    test(`homepage polish ${theme} ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("werewolf-theme", selectedTheme);
        localStorage.setItem("welcome-modal-shown", "1");
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("last-family", "mafia");
      }, theme);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
      });
      await page.goto("/");
      await expect(page).toHaveTitle("Сенките | Върколак и Мафия онлайн");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Върколак или Мафия");
      const kicker = await page.locator(".landing-hero-card > .section-kicker").boundingBox();
      const title = await page.getByRole("heading", { level: 1 }).boundingBox();
      const introGap = title!.y - kicker!.y - kicker!.height;
      expect(introGap, "the introductory label should stay visually connected to the title").toBeGreaterThanOrEqual(6);
      expect(introGap).toBeLessThanOrEqual(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width!);
      const cards = page.locator(".game-choice-card");
      await expect(cards).toHaveCount(2);
      for (const card of await cards.all()) {
        const image = card.locator("img").filter({ visible: true });
        await expect(image).toHaveCount(1);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((element) => (element as HTMLImageElement).decode());
        for (const link of await card.getByRole("link").all()) {
          const box = await link.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(28);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width!);
        }
      }
      // Lazy scenes may be below the fold; measure the first screen back at the top.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const firstAction = await cards.first().getByRole("link", { name: "Създай стая", exact: true }).boundingBox();
      const immediateAction = page.locator(".site-play-cta").filter({ visible: true });
      await expect(immediateAction).toHaveCount(1);
      const immediateBox = (await immediateAction.boundingBox())!;
      expect(immediateBox.height).toBeGreaterThanOrEqual(44);
      expect(immediateBox.y).toBeGreaterThanOrEqual(0);
      expect(immediateBox.y + immediateBox.height).toBeLessThanOrEqual(height! - 8);
      // The illustrated card may extend below the fold, but its action stays within a short scroll.
      expect(firstAction!.y + firstAction!.height).toBeLessThanOrEqual(height! * 1.5);
      await expect(page.getByText("Продължи", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Последно разглеждана", { exact: true })).toBeVisible();
      const introduction = page.getByRole("region", { name: "Първата ти игра" });
      await expect(introduction.getByRole("listitem")).toHaveCount(3);
      if (width! < 768) expect((await introduction.boundingBox())!.height).toBeLessThan(500);
      const ending = page.getByRole("region", { name: "Готов ли си да седнеш на масата" });
      await expect(ending.getByRole("link", { name: "Играй Върколак" })).toHaveAttribute("href", "/werewolf/create");
      await expect(ending.getByRole("link", { name: "Играй Мафия" })).toHaveAttribute("href", "/mafia/create");
      await expectHeroContrast(page);
      if (width === 320 || width === 1920) {
        const accessibility = await new AxeBuilder({ page })
          .include(".landing-shell")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(accessibility.violations).toEqual([]);
      }
      await page.screenshot({ path: info.outputPath("first-screen.png"), caret: "initial" });
      await introduction.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("first-game.png"), caret: "initial" });
      await ending.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("page-end.png"), caret: "initial" });
      expect(errors).toEqual([]);
    });
  }
}

for (const family of ["werewolf", "mafia"]) {
  for (const action of ["create", "join"] as const) {
    test(`homepage guest navigation ${family} ${action}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("welcome-modal-shown", "1");
        localStorage.setItem("cookie-consent", "1");
      });
      await page.goto("/");
      const link = page.locator(`.game-choice-${family}`).getByRole("link", {
        name: action === "create" ? "Създай стая" : "Имам код",
        exact: true,
      });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname === "/sign-in");
      expect(new URL(page.url()).searchParams.get("redirect")).toBe(`/${family}/${action}`);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator(".landing-shell")).toBeHidden();
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`homepage loads only selected theme art ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light" });
      await page.addInitScript((selected) => {
        localStorage.setItem("werewolf-theme", selected);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      const requested: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() !== "image") return;
        const url = new URL(request.url());
        const source = url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
        requested.push(source ? new URL(source, url.origin).pathname : url.pathname);
      });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const chosen = theme === "light" ? "bg-landing-hero-light-v1" : "bg-landing-hero-composited";
      const unused = theme === "dark" ? "bg-landing-hero-light-v1" : "bg-landing-hero-composited";
      await expect.poll(() => requested.some((path) => path.includes(chosen))).toBe(true);
      expect(requested.filter((path) => path.includes(unused))).toEqual([]);
      const heroRequests = requested.filter((path) => path.includes(chosen));
      expect(heroRequests.every((path) => path.includes("/mobile/") === (width < 721))).toBe(true);
      for (const family of ["werewolf", "mafia"]) {
        const version = family === "werewolf" ? "v7" : "v5";
        const card = page.locator(`.game-choice-${family}`);
        const image = card.locator("img").filter({ visible: true });
        await expect(image).toHaveCount(1);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((element) => (element as HTMLImageElement).decode());
        const expected = `/game-art/homepage/choice-${family}-${theme}-${version}.webp`;
        expect(requested.filter((path) => path.includes(`/choice-${family}-`))).toEqual([expected]);
        const selected = new URL(await image.evaluate((element) => (element as HTMLImageElement).currentSrc));
        expect(selected.pathname).toBe("/_next/image");
        expect(selected.searchParams.get("url")).toBe(expected);
        const targetWidth = await image.evaluate((element) => element.getBoundingClientRect().width * devicePixelRatio);
        expect(Number(selected.searchParams.get("w"))).toBeGreaterThanOrEqual(targetWidth);
      }
    });
  }
}
