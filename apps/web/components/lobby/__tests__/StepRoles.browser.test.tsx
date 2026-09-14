import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { chromium, type Browser } from "playwright";
import { expect as browserExpect } from "playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkRoleEditorWorkflow } from "../../../__visual__/role-editor-workflow";

const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("vitest/package.json"));
const origin = "https://role-editor.test";
const publicRoot = resolve(process.cwd(), "public");
let browser: Browser;
let assets: { bundle: string; css: string };

beforeAll(async () => {
  // Use the installed compiler toolchain in Node, outside JSDOM's typed-array realm.
  assets = JSON.parse(execFileSync(process.execPath, ["-e", `
    const { readFileSync } = require('node:fs');
    const { resolve } = require('node:path');
    const { buildSync } = require(${JSON.stringify(toolchain.resolve("esbuild"))});
    const { transform } = require(${JSON.stringify(toolchain.resolve("lightningcss"))});
    const postcss = require(${JSON.stringify(toolchain.resolve("postcss"))});
    const tailwind = require(${JSON.stringify(require.resolve("@tailwindcss/postcss"))});
    const config = JSON.parse(readFileSync(0, 'utf8'));
    (async () => {
      const filename = resolve('app/globals.css');
      const globals = await postcss([tailwind()]).process(readFileSync(filename, 'utf8'), { from: filename });
      const modules = ['components/lobby/LegacyCreate.module.css', 'components/ManualRoleBuilder.module.css'];
      const css = globals.css + modules.map(filename => transform({
        filename, code: readFileSync(filename), cssModules: true,
      }).code.toString()).join('');
      process.stdout.write(JSON.stringify({ bundle: buildSync(config).outputFiles[0].text, css }));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], {
    encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
    input: JSON.stringify({
      absWorkingDir: process.cwd(), bundle: true, write: false, platform: "browser", format: "iife",
      alias: { "@": process.cwd(), "next/image": resolve(process.cwd(), "components/__tests__/fixtures/NextImage.tsx") },
      jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
      stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
        import { useReducer, useRef, useState } from "react";
        import { createRoot } from "react-dom/client";
        import { CreateCustomizationSheet } from "./components/lobby/CreateCustomizationSheet";
        import { initialState, lobbyFormReducer } from "./lib/lobby-form";
        function Fixture() {
          const [state, dispatch] = useReducer(lobbyFormReducer, initialState({
            family: document.documentElement.dataset.family,
          }));
          const [open, setOpen] = useState(false);
          const trigger = useRef(null);
          return <>
            <button ref={trigger} onClick={() => setOpen(true)}>Настрой детайлите</button>
            <CreateCustomizationSheet state={state} dispatch={dispatch} open={open} onOpenChange={setOpen}
              onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} />
          </>;
        }
        createRoot(document.querySelector('#root')).render(<Fixture />);
      ` },
    }),
  }));
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => { await browser?.close(); });

// CI's unit job installs Chromium only. No HTTP listener or Next runtime is started.
describe("role editor with production components and CSS", () => {
  for (const family of ["werewolves", "mafia"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const width of [390, 1440]) {
        it(`${family} ${theme} ${width}px keeps filters reachable after roster changes`, async () => {
          const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme });
          page.setDefaultTimeout(5_000);
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
          try {
            await page.route("**/*", async (route) => {
              const url = new URL(route.request().url());
              if (url.origin !== origin) return route.abort();
              if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: `
                <!doctype html><html lang="bg" data-theme="${theme}" data-family="${family}"><head>
                <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Role editor fixture</title><style>
                @font-face { font-family: FixtureLiterata; src: url('/fonts/literata-reading.woff2'); font-weight: 400 700; }
                @font-face { font-family: FixtureSofia; src: url('/fonts/sofia-sans-interface.woff2'); font-weight: 400 700; }
                :root { --font-literata: FixtureLiterata; --font-sofia: FixtureSofia; }
                ${assets.css}</style></head><body>
                <main id="root"></main><script src="/fixture.js"></script></body></html>` });
              if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "text/javascript", body: assets.bundle });
              if (["/fonts/literata-reading.woff2", "/fonts/sofia-sans-interface.woff2"].includes(url.pathname)) {
                return route.fulfill({ path: resolve(process.cwd(), `app${url.pathname}`) });
              }
              const source = url.pathname === "/_next/image" ? url.searchParams.get("url")! : url.pathname;
              const path = resolve(publicRoot, `.${new URL(source, origin).pathname}`);
              if (!path.startsWith(publicRoot + sep)) return route.abort();
              return route.fulfill({ path });
            });
            await page.goto(origin);
            await browserExpect(page).toHaveTitle("Role editor fixture");
            await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
            const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
            await dialog.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
            await page.evaluate(() => document.fonts.ready);
            await checkRoleEditorWorkflow(dialog, family, width === 390);
            await dialog.locator(".create-customization-panel").evaluate((element) => { element.scrollTop = 0; });
            await dialog.locator(".role-tile-large").first().locator("img").evaluate((element: HTMLImageElement) => element.decode());
            await page.screenshot({ path: join(tmpdir(), `role-editor-${family}-${theme}-${width}.png`) });
            await dialog.getByRole("button", { name: "Готово", exact: true }).click();
            await browserExpect(dialog).toBeHidden();
            await browserExpect(page.getByRole("button", { name: "Настрой детайлите", exact: true })).toBeFocused();
            expect(errors).toEqual([]);
          } finally {
            await page.close();
          }
        }, 30_000);
      }
    }
  }
});
