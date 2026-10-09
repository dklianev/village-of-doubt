import { createServer, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("vitest/package.json"));
const { transform } = toolchain("lightningcss") as {
  transform(options: { filename: string; code: Buffer; cssModules: boolean }): { code: Buffer };
};
const filename = resolve(process.cwd(), "components/play/ReconnectModal.module.css");
const css = transform({ filename, code: readFileSync(filename), cssModules: true }).code.toString();

describe("native recovery above an existing sheet", () => {
  let server: Server;
  let origin: string;
  beforeAll(async () => {
    const config = {
      stdin: {
        resolveDir: process.cwd(),
        contents: `import React, { useState } from "react";
          import { createRoot } from "react-dom/client";
          import { Sheet } from "@werewolf/ui";
          import { ReconnectModal } from "./components/play/ReconnectModal";
          function Fixture() {
            const [open, setOpen] = useState(false);
            const [lost, setLost] = useState(false);
            window.disconnect = () => setLost(true);
            window.closeAll = () => { setOpen(false); setLost(false); };
            return <><button onClick={() => setOpen(true)}>Open rules</button>
              <Sheet open={open} size="workspace" onOpenChange={setOpen} title="Правила">
                <button>Current phase</button>
              </Sheet>
              {lost && <ReconnectModal status="lost" message="Връзката прекъсна."
                onRetry={() => setLost(false)} />}
            </>;
          }
          createRoot(document.getElementById("root")).render(<Fixture />);`,
        loader: "tsx",
      },
      bundle: true, write: false, format: "iife", jsx: "automatic",
      alias: { "@": resolve(process.cwd()) },
      loader: { ".css": "empty", ".module.css": "empty" },
      define: { "process.env.NODE_ENV": '"production"' },
    };
    const script = execFileSync(process.execPath, ["-e", `
      const config = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      process.stdout.write(require(${JSON.stringify(toolchain.resolve("esbuild"))}).buildSync(config).outputFiles[0].text);
    `], { input: JSON.stringify(config), encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
    server = createServer((request, response) => {
      response.setHeader("Content-Type", request.url === "/fixture.js" ? "text/javascript" : "text/html; charset=utf-8");
      response.end(request.url === "/fixture.js" ? script :
        `<!doctype html><html lang="bg"><meta charset="utf-8"><title>Recovery fixture</title><style>${css}</style><div id="root"></div><script src="/fixture.js"></script></html>`);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });

  const engines = process.env.RECONNECT_ALL_BROWSERS === "1" ? { chromium, firefox, webkit } : { chromium };
  it.each(Object.keys(engines))("retains focus, blocks outside input and restores the sheet in %s", async (name) => {
    const engine = engines[name as keyof typeof engines]!;
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 667 } });
      page.setDefaultTimeout(5_000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(origin);
      await page.getByRole("button", { name: "Open rules" }).click();
      const sheet = page.getByRole("dialog", { name: "Правила" });
      const sheetButton = sheet.getByRole("button", { name: "Current phase" });
      await sheetButton.focus();
      await page.evaluate(() => (window as unknown as { disconnect(): void }).disconnect());
      const dialog = page.getByRole("dialog", { name: "Връзката е прекъсната" });
      await dialog.waitFor();
      expect(await dialog.evaluate(element => element.matches(":modal"))).toBe(true);
      const retry = dialog.getByRole("button", { name: "Опитай пак" });
      await retry.waitFor();
      expect(await retry.evaluate(element => element === document.activeElement)).toBe(true);
      await page.locator(".ds-sheet button").first().evaluate(element => (element as HTMLElement).focus());
      expect(await retry.evaluate(element => element === document.activeElement)).toBe(true);
      await page.keyboard.press("Escape");
      expect(await dialog.isVisible()).toBe(true);
      await page.keyboard.press("Shift+Tab");
      expect(await dialog.getByRole("button", { name: "Презареди" }).evaluate(element => element === document.activeElement)).toBe(true);
      await page.keyboard.press("Tab");
      expect(await retry.evaluate(element => element === document.activeElement)).toBe(true);
      await page.setViewportSize({ width: 390, height: 200 });
      await dialog.evaluate(element => { element.scrollTop = 0; });
      await dialog.hover();
      await page.mouse.wheel(0, 200);
      await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await page.setViewportSize({ width: 390, height: 667 });
      await retry.click();
      await dialog.waitFor({ state: "detached" });
      expect(await sheet.isVisible()).toBe(true);
      expect(await sheetButton.evaluate(element => element === document.activeElement)).toBe(true);
      await page.keyboard.press("Escape");
      await sheet.waitFor({ state: "detached" });
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      await page.getByRole("button", { name: "Open rules" }).click();
      await sheet.waitFor();
      await page.evaluate(() => (window as unknown as { disconnect(): void }).disconnect());
      await dialog.waitFor();
      await page.evaluate(() => (window as unknown as { closeAll(): void }).closeAll());
      await dialog.waitFor({ state: "detached" });
      await sheet.waitFor({ state: "detached" });
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
      expect(errors).toEqual([]);
    } finally { await browser.close(); }
  }, 30_000);
});
