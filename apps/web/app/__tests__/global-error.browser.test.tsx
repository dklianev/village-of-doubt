import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import GlobalError from "../global-error";
import styles from "../GlobalError.module.css";

const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("vitest/package.json"));
const { transform } = toolchain("lightningcss") as {
  transform(options: { filename: string; code: Buffer; cssModules: boolean }): {
    code: Buffer;
    exports: Record<string, { name: string }>;
  };
};
const filename = resolve(process.cwd(), "app/GlobalError.module.css");
const compiled = transform({ filename, code: readFileSync(filename), cssModules: true });

// Render the actual document with only its own CSS, including before hydration.
function standaloneDocument(theme?: "light" | "dark") {
  const markup = renderToStaticMarkup(<GlobalError error={new Error("synthetic failure")} retry={() => {}} />);
  const document = new DOMParser().parseFromString(markup, "text/html");
  for (const element of document.querySelectorAll("[class]")) {
    for (const [key, value] of Object.entries(compiled.exports)) {
      if (styles[key]) element.classList.replace(styles[key], value.name);
    }
  }
  if (theme) document.documentElement.dataset.theme = theme;
  const sheet = document.createElement("style");
  sheet.textContent = compiled.code.toString();
  document.head.append(sheet);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

describe("standalone global error CSS without root styles, fonts or art", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); });

  for (const width of [375, 1280]) {
    for (const theme of ["dark", "light"] as const) {
      it(`${width}px follows the ${theme} OS theme with readable independent actions`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 850 }, colorScheme: theme });
        try {
          const requests: string[] = [];
          page.on("request", (request) => requests.push(request.url()));
          await page.setContent(standaloneDocument());
          expect(await page.getByRole("alert", { name: "Страницата не се зареди." }).count()).toBe(1);
          expect(await page.getByRole("heading", { name: "Страницата не се зареди." }).isVisible()).toBe(true);
          expect(await page.getByRole("banner", { name: "Сенките" }).innerText()).toBe("Сенките");
          const presentation = await page.evaluate(() => {
            const body = getComputedStyle(document.body);
            const heading = getComputedStyle(document.querySelector("h1")!);
            const button = document.querySelector("button")!;
            const action = getComputedStyle(button);
            return {
              background: body.backgroundColor,
              text: body.color,
              bodyFont: body.fontFamily,
              headingFont: heading.fontFamily,
              actionColor: action.color,
              actionBackground: action.backgroundColor,
              actionHeight: button.getBoundingClientRect().height,
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
            };
          });
          expect(presentation).toMatchObject({
            background: theme === "dark" ? "rgb(21, 24, 25)" : "rgb(244, 245, 243)",
            text: theme === "dark" ? "rgb(241, 244, 243)" : "rgb(30, 39, 37)",
            actionColor: "rgb(255, 255, 255)",
            actionBackground: theme === "dark" ? "rgb(181, 54, 50)" : "rgb(155, 38, 40)",
          });
          expect(presentation.bodyFont).toContain("Arial");
          expect(presentation.headingFont).toContain("Georgia");
          expect(presentation.actionHeight).toBeGreaterThanOrEqual(48);
          expect(presentation.width).toBeLessThanOrEqual(width);
          expect(presentation.height).toBeLessThanOrEqual(850);

          const heading = page.getByRole("heading");
          const retry = page.getByRole("button", { name: "Опитай отново" });
          const home = page.getByRole("link", { name: "Към началото" });
          const report = page.getByRole("link", { name: "Подай сигнал" });
          await heading.focus();
          await page.keyboard.press("Tab");
          expect(await retry.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await retry.evaluate((node) => getComputedStyle(node).outlineWidth)).toBe("3px");
          await page.keyboard.press("Tab");
          expect(await home.evaluate((node) => node === document.activeElement)).toBe(true);
          await page.keyboard.press("Tab");
          expect(await report.evaluate((node) => node === document.activeElement)).toBe(true);

          const retryBox = (await retry.boundingBox())!;
          const homeBox = (await home.boundingBox())!;
          const reportBox = (await report.boundingBox())!;
          if (width < 480) expect(homeBox.y).toBeGreaterThanOrEqual(retryBox.y + retryBox.height);
          else expect(homeBox.x).toBeGreaterThanOrEqual(retryBox.x + retryBox.width);
          expect(reportBox.y).toBeGreaterThanOrEqual(homeBox.y + homeBox.height);
          expect(await page.locator("img, link[rel=stylesheet]").count()).toBe(0);
          expect(requests).toEqual([]);
          await page.screenshot({ path: join(tmpdir(), `step7-global-error-${theme}-${width}.png`), fullPage: true });
        } finally {
          await page.close();
        }
      }, 15_000);
    }
  }

  it.each(["light", "dark"] as const)("respects the saved %s theme against the OS preference", async (theme) => {
    const page = await browser.newPage({ colorScheme: theme === "light" ? "dark" : "light" });
    try {
      await page.setContent(standaloneDocument(theme));
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
        .toBe(theme === "dark" ? "rgb(21, 24, 25)" : "rgb(244, 245, 243)");
    } finally {
      await page.close();
    }
  });
});
