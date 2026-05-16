import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.resolve("docs/regression-audit");
const screenshotDir = path.join(outDir, "screenshots");

const routes = [
  "/",
  "/werewolf",
  "/mafia",
  "/werewolf/create",
  "/mafia/create",
  "/werewolf/join",
  "/mafia/join",
  "/werewolf/join/TEST01",
  "/mafia/join/TEST01",
  "/werewolf/roles",
  "/mafia/roles",
  "/roles",
  "/werewolf/rules",
  "/mafia/rules",
  "/tutorial",
  "/sign-in",
  "/lobby",
  "/lobby/TEST01",
  "/play/TEST01",
  "/history",
  "/leaderboard",
  "/achievements",
  "/friends",
  "/offline",
  "/this-does-not-exist",
];

const screenshotRoutes = ["/", "/sign-in", "/tutorial?step=1", "/history", "/leaderboard", "/achievements"];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const consoleMessages = [];
    const pageErrors = [];
    const failedResponses = [];
    const requestFailures = [];

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleMessages.push({
          type: message.type(),
          text: message.text(),
        });
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) {
        failedResponses.push({
          status,
          url: response.url(),
        });
      }
    });
    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        failure: request.failure()?.errorText ?? "unknown",
      });
    });

    const url = new URL(route, baseURL).toString();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      const layout = await page.evaluate(() => ({
        path: location.pathname + location.search,
        title: document.title,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        bodyText: document.body.innerText.slice(0, 500),
      }));
      results.push({
        route,
        finalUrl: page.url(),
        consoleMessages,
        pageErrors,
        failedResponses,
        requestFailures,
        horizontalOverflow: layout.scrollWidth > layout.innerWidth + 1,
        layout,
      });
    } catch (error) {
      results.push({
        route,
        finalUrl: page.url(),
        consoleMessages,
        pageErrors,
        failedResponses,
        requestFailures,
        navigationError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await context.close();
    }
  }

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const route of screenshotRoutes) {
      const safeName = `${viewport.name}-${route.replace(/[/?=&]/g, "-").replace(/^-+/, "") || "home"}.png`;
      await page.goto(new URL(route, baseURL).toString(), { waitUntil: "networkidle", timeout: 30_000 });
      await page.screenshot({ path: path.join(screenshotDir, safeName), fullPage: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, "runtime-probe-results.json"), `${JSON.stringify(results, null, 2)}\n`);

const summary = results.map((result) => ({
  route: result.route,
  finalUrl: result.finalUrl,
  console: result.consoleMessages?.length ?? 0,
  pageErrors: result.pageErrors?.length ?? 0,
  failedResponses: result.failedResponses?.length ?? 0,
  requestFailures: result.requestFailures?.length ?? 0,
  horizontalOverflow: Boolean(result.horizontalOverflow),
  navigationError: result.navigationError ?? "",
}));

console.log(JSON.stringify(summary, null, 2));
