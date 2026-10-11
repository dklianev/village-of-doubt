import { expect, test, type Page, type Request } from "playwright/test";

// Run against an already-running local `next start`, never the config's dev server:
// PARTIAL_PREFETCH_PRODUCTION=1 VISUAL_REUSE_SERVER=1 VISUAL_WEB_PORT=<port>
// PARTIAL_PREFETCH_AUTH_STATE=<synthetic local test-account storageState.json>
// pnpm exec playwright test --config=playwright.config.ts partial-prefetch-pilot.spec.ts
// /join is the only default-prefetch FAQ source. Its server auth must be real;
// visualAuth=1 is dev-only and a browser get-session mock cannot authenticate it.
const productionPilot = process.env.PARTIAL_PREFETCH_PRODUCTION === "1";
const authState = process.env.PARTIAL_PREFETCH_AUTH_STATE;

const journeys = [
  {
    source: "/werewolf", destination: "/werewolf/rules", sourceTitle: "Върколак",
    title: "Правила за Върколак", anchor: '.night-timeline a[href="/werewolf/rules"]',
    content: "#rules-objective li", minimumItems: 2, marker: "rules-objective", needsSession: false,
  },
  {
    source: "/mafia", destination: "/mafia/rules", sourceTitle: "Мафия",
    title: "Правила за Мафия", anchor: '.night-timeline a[href="/mafia/rules"]',
    content: "#rules-objective li", minimumItems: 2, marker: "rules-objective", needsSession: false,
  },
  {
    source: "/join", destination: "/faq", sourceTitle: "Влез с код",
    title: "Помощ", anchor: '.join-entry-footer a[href="/faq"]',
    content: ".faq-hearth-item-question", minimumItems: 10, marker: '"slug":"report-issue"', needsSession: true,
  },
  {
    source: "/faq", destination: "/terms", sourceTitle: "Помощ",
    title: "Условия за ползване", anchor: '#faq-report-issue a[href="/terms"]',
    content: ".terms-annex-body", minimumItems: 6, marker: "terms-annex-body", needsSession: false,
  },
] as const;

function isFlight(request: Request) {
  return request.headers().rsc === "1";
}

async function expectDestination(page: Page, journey: typeof journeys[number]) {
  await expect(page).toHaveURL((url) => url.pathname === journey.destination && url.search === "");
  await expect(page.getByRole("heading", { level: 1, name: journey.title, exact: true })).toBeVisible();
  await expect(page.locator(journey.content).first()).toBeVisible();
  expect(await page.locator(journey.content).count()).toBeGreaterThanOrEqual(journey.minimumItems);
  await expect(page.locator(journey.content).first()).not.toBeEmpty();
}

for (const appearance of [
  { name: "desktop dark", theme: "dark", viewport: { width: 1440, height: 1000 } },
  { name: "mobile light", theme: "light", viewport: { width: 390, height: 844 } },
] as const) {
  test.describe(`production partial prefetch: ${appearance.name}`, () => {
    test.skip(!productionPilot, "Automatic Next prefetch requires a production build and next start.");
    test.use({ viewport: appearance.viewport, colorScheme: appearance.theme, serviceWorkers: "block" });

    for (const journey of journeys) {
      test.describe(journey.destination, () => {
        if (journey.needsSession && authState) test.use({ storageState: authState });

        test("prefetches the source Link, renders without new route data and survives history", async ({ page, baseURL }, testInfo) => {
          expect(process.env.VISUAL_REUSE_SERVER, "Start the production server first; do not run this against next dev.").toBe("1");
          expect(baseURL).toBeTruthy();
          const origin = new URL(baseURL!).origin;
          expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(origin).hostname);
          if (journey.needsSession) {
            expect(authState, "PARTIAL_PREFETCH_AUTH_STATE must point to a synthetic local test-account storageState file for /join -> /faq.").toBeTruthy();
          }

          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
          });
          await page.addInitScript((theme) => {
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("welcome-modal-shown", "1");
            localStorage.setItem("werewolf-theme", theme);
          }, appearance.theme);
          if (!journey.needsSession) {
            // Only the unrelated auth chip is stubbed. Documents and Flight stay real.
            await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
          }

          const completedPrefetches: Array<Promise<boolean>> = [];
          let holdRouteData = false;
          let releaseRouteData = () => {};
          const routeDataGate = new Promise<void>((resolve) => { releaseRouteData = resolve; });
          const documentRequests: string[] = [];
          page.on("request", (request) => {
            if (holdRouteData && request.isNavigationRequest()) documentRequests.push(new URL(request.url()).pathname);
          });
          page.on("response", (response) => {
            const request = response.request();
            const url = new URL(response.url());
            if (!holdRouteData && url.origin === origin && url.pathname === journey.destination &&
                isFlight(request) && request.headers()["next-router-prefetch"] === "1") {
              completedPrefetches.push((async () => {
                if (!response.ok() || !response.headers()["content-type"]?.includes("text/x-component")) return false;
                // A route-tree-only prefetch is not evidence of meaningful prefetched UI.
                // Use structural markers: Chromium's CDP body decoding of charset-less
                // text/x-component differs from fetch().text(). Bulgarian is checked in the DOM.
                return (await response.body()).toString("utf8").includes(journey.marker);
              })().catch(() => false));
            }
          });
          await page.route((url) => url.origin === origin && url.pathname === journey.destination, async (route) => {
            if (holdRouteData && (isFlight(route.request()) || route.request().isNavigationRequest())) {
              await routeDataGate;
            }
            await route.continue();
          });

          // The sole goto establishes the source. All destination visits use Link/history.
          await page.goto(journey.source);
          await expect(page).toHaveURL((url) => url.pathname === journey.source);
          await expect(page.getByRole("heading", { level: 1, name: journey.sourceTitle, exact: true })).toBeVisible();
          if (journey.destination === "/terms") {
            await page.locator("#faq-report-issue .faq-hearth-item-handle").click();
            await expect(page.locator("#faq-report-issue .faq-hearth-item-handle")).toHaveAttribute("aria-expanded", "true");
          }

          const link = page.locator(journey.anchor);
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("href", journey.destination);
          await link.scrollIntoViewIfNeeded();
          await expect(link).toBeInViewport();
          // No router.prefetch(), manual fetch, forced prefetch prop or rewritten href.
          await expect.poll(async () => (await Promise.all(completedPrefetches)).some(Boolean), {
            message: `Expected automatic production Flight prefetch for ${journey.destination} before clicking its source Link`,
            timeout: 15_000,
          }).toBe(true);

          const sourceURL = page.url();
          const documentMarker = "partial-prefetch-pilot";
          await page.evaluate((marker) => { document.documentElement.dataset.prefetchPilot = marker; }, documentMarker);

          // Unlike instant(), this needs no exposeTestingApiInProductionBuild config.
          // Hold ALL new destination Flight/document requests, not just dynamic ones.
          // Content must come from the observed automatic prefetch and client chunks.
          holdRouteData = true;
          try {
            await link.click();
            await expectDestination(page, journey);
            await expect(page.locator("html")).toHaveAttribute("data-prefetch-pilot", documentMarker);

            await page.goBack();
            await expect(page).toHaveURL(sourceURL);
            await expect(page.getByRole("heading", { level: 1, name: journey.sourceTitle, exact: true })).toBeVisible();
            await expect(link).toBeVisible();

            await page.goForward();
            await expectDestination(page, journey);
            await expect(page.locator("html")).toHaveAttribute("data-prefetch-pilot", documentMarker);
            expect(documentRequests, "Link and history must not fall back to document navigation").toEqual([]);
            expect(errors).toEqual([]);
          } finally {
            holdRouteData = false;
            releaseRouteData();
            await page.unrouteAll({ behavior: "wait" });
          }

          await expectDestination(page, journey);
          await expect(page).toHaveTitle(new RegExp(journey.title));
          await expect(page.locator("html")).toHaveAttribute("data-theme", appearance.theme);
          await testInfo.attach("prefetched-destination", { body: await page.screenshot(), contentType: "image/png" });
          expect(errors).toEqual([]);
        });
      });
    }
  });
}
