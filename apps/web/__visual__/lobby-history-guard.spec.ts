import { expect, test, type Page } from "playwright/test";

const lobbyPath = "/play/VISUAL?visualGame=1&family=werewolves&phase=lobby&players=8&viewer=host";
const readyStage = '.play-stage[data-layout-ready="true"]';
const browserName = (process.env.LOBBY_HISTORY_BROWSER ?? "chromium") as "chromium" | "firefox" | "webkit";
test.use({ browserName, viewport: { width: 1440, height: 900 } });

async function pushRoute(page: Page, href: string) {
  // Next 16 exposes its real App Router here; only setup uses it. Traversals
  // below go through browser history, never a mocked router or synthetic event.
  await page.evaluate((href) => {
    const next = (window as Window & { next?: { router: { push: (href: string) => void } } }).next;
    if (!next) throw new Error("Next App Router has not hydrated");
    next.router.push(href);
  }, href);
  await expect(page).toHaveURL(href, { timeout: 30_000 });
}

async function historySnapshot(page: Page) {
  return page.evaluate(() => ({ href: location.href, length: history.length, state: history.state }));
}

async function traverseHistory(page: Page, delta: number) {
  // Match a fresh browser-UI gesture for each scripted multi-entry traversal.
  await page.keyboard.press("ArrowRight");
  await page.evaluate((delta) => history.go(delta), delta);
}

async function confirmOnce(page: Page, accept: boolean, action: () => Promise<unknown>) {
  const dialogs: string[] = [];
  const handler = async (dialog: import("playwright/test").Dialog) => {
    dialogs.push(dialog.type());
    expect(dialog.message()).toContain("домакин");
    if (accept) await dialog.accept();
    else await dialog.dismiss();
  };
  page.on("dialog", handler);
  try {
    // Chromium reports ERR_ABORTED for a successfully cancelled native traversal.
    await action().catch((error: unknown) => {
      if (accept || dialogs.length !== 1 || !(error instanceof Error) || !/ERR_ABORTED|aborted|interrupted|Timeout/i.test(error.message)) throw error;
    });
    await expect.poll(() => dialogs.length).toBe(1);
    // Wait through both the traversal and a possible compensating popstate.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(dialogs).toEqual(["confirm"]);
  } finally {
    page.off("dialog", handler);
  }
}

for (const fallback of [false, true]) {
  test.describe(`${browserName} ${fallback ? "legacy history" : "available navigation API"}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
      await page.addInitScript((fallback) => {
        localStorage.setItem("werewolf-theme", "dark");
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
        if (fallback) Object.defineProperty(window, "navigation", { configurable: true, value: undefined });
      }, fallback);
      await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
    });

    test("brand, Back, Forward: cancel and accept on repeated lobby visits", async ({ page }) => {
      await page.goto(lobbyPath);
      await expect(page.locator(readyStage)).toBeVisible();
      const initial = await historySnapshot(page);
      await confirmOnce(page, true, () => page.locator(".site-brand").click());
      await expect(page).toHaveURL("/");
      const home = await historySnapshot(page);
      expect(home.length).toBe(initial.length + 1);

      for (let visit = 0; visit < 3; visit++) {
        await page.goBack();
        await expect(page).toHaveURL(lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        const before = await historySnapshot(page);
        const stage = await page.locator(readyStage).elementHandle();
        for (let attempt = 0; attempt < 2; attempt++) {
          await confirmOnce(page, false, () => page.goForward({ waitUntil: "commit", timeout: 2_000 }));
          await expect(page).toHaveURL(lobbyPath);
          await expect(page.locator(readyStage)).toBeVisible();
          expect(await stage!.evaluate((element) => element.isConnected)).toBe(true);
          expect(await historySnapshot(page)).toEqual(before);
        }
        await confirmOnce(page, true, () => page.goForward({ waitUntil: "commit" }));
        await expect(page).toHaveURL("/");
        await expect(page.locator(readyStage)).toBeHidden();
        expect(await historySnapshot(page)).toEqual(home);
      }
    });

    test("Back and multi-entry jumps restore URL, query, hash and the mounted lobby", async ({ page }) => {
      await page.goto("/terms");
      await expect(page.locator(".site-chrome:not([data-fallback])")).toBeVisible();
      await page.locator(".site-brand").click();
      await expect(page).toHaveURL("/");
      await pushRoute(page, lobbyPath);
      await expect(page.locator(readyStage)).toBeVisible();
      // Exercise native fragment entries as well as Next's pushState entries.
      await page.evaluate(() => { location.hash = "main-content"; });
      await expect(page).toHaveURL(`${lobbyPath}#main-content`);
      await page.goBack();
      await expect(page).toHaveURL(lobbyPath);
      await page.goForward();
      await expect(page).toHaveURL(`${lobbyPath}#main-content`);
      const before = await historySnapshot(page);
      const stage = await page.locator(readyStage).elementHandle();
      await confirmOnce(page, false, () => traverseHistory(page, -2));
      await expect(page).toHaveURL(`${lobbyPath}#main-content`);
      expect(await historySnapshot(page)).toEqual(before);
      expect(await stage!.evaluate((element) => element.isConnected)).toBe(true);
      await expect(page.locator(readyStage)).toBeVisible();
      await confirmOnce(page, true, () => traverseHistory(page, -3));
      await expect(page).toHaveURL("/terms");
      await expect(page.locator(readyStage)).toBeHidden();
      await traverseHistory(page, 3);
      await expect(page).toHaveURL(`${lobbyPath}#main-content`);
      await expect(page.locator(readyStage)).toBeVisible();
      expect((await historySnapshot(page)).length).toBe(before.length);
    });

    test("confirmed document links prompt once; modified links keep the lobby", async ({ page, context }) => {
      await page.goto(lobbyPath);
      await expect(page.locator(readyStage)).toBeVisible();
      const popupPromise = context.waitForEvent("page");
      await page.locator(".site-brand").click({ modifiers: ["ControlOrMeta"] });
      await (await popupPromise).close();
      await expect(page).toHaveURL(lobbyPath);
      await expect(page.locator(readyStage)).toBeVisible();
      // A plain same-origin anchor deliberately exercises beforeunload, not Link.
      await page.evaluate(() => {
        const anchor = document.createElement("a");
        anchor.href = "/faq?from=lobby#main-content";
        anchor.textContent = "Document exit";
        anchor.id = "history-guard-document-exit";
        Object.assign(anchor.style, { position: "fixed", top: "80px", right: "8px", zIndex: "99999" });
        document.body.prepend(anchor);
      });
      await confirmOnce(page, true, () => page.locator("#history-guard-document-exit").click());
      await expect(page).toHaveURL("/faq?from=lobby#main-content");
    });

    for (const canceled of [false, true]) {
      test(`unload still warns after an accepted ${canceled ? "link canceled by a later handler" : "SPA exit and return"}`, async ({ page }) => {
        await page.goto(lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        const stage = await page.locator(readyStage).elementHandle();
        if (canceled) {
          // The guard accepts first; the target then cancels Next's link action.
          await page.locator(".site-brand").evaluate((anchor) => {
            anchor.addEventListener("click", (event) => event.preventDefault(), { once: true });
          });
        }
        await confirmOnce(page, true, () => page.locator(".site-brand").click());
        if (canceled) {
          expect(await stage!.evaluate((element) => element.isConnected)).toBe(true);
        } else {
          await expect(page).toHaveURL("/");
          await page.goBack();
        }
        await expect(page).toHaveURL(lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        const dialogs: string[] = [];
        const onDialog = async (dialog: import("playwright/test").Dialog) => {
          dialogs.push(dialog.type());
          await dialog.accept();
        };
        page.on("dialog", onDialog);
        try {
          await page.reload();
          await expect(page.locator(readyStage)).toBeVisible();
          expect(dialogs).toEqual(["beforeunload"]);
        } finally {
          page.off("dialog", onDialog);
        }
      });
    }

    if (fallback) {
      test("first home-to-lobby Back cancels without an earlier lobby visit", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("button", { name: "Още страници" })).toBeEnabled();
        const home = await historySnapshot(page);
        await pushRoute(page, lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        const before = await historySnapshot(page);
        const stage = await page.locator(readyStage).elementHandle();
        await confirmOnce(page, false, () => page.goBack({ waitUntil: "commit", timeout: 2_000 }));
        await expect(page).toHaveURL(lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        expect(await stage!.evaluate((element) => element.isConnected)).toBe(true);
        expect(await historySnapshot(page)).toEqual(before);
        await confirmOnce(page, true, () => page.goBack({ waitUntil: "commit" }));
        await expect(page).toHaveURL("/");
        expect((await historySnapshot(page)).state).toEqual(home.state);
        expect((await historySnapshot(page)).length).toBe(home.length + 1);
      });

      test("untagged Forward is not trapped and does not corrupt the router", async ({ page }) => {
        await page.goto(lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        await confirmOnce(page, true, () => page.locator(".site-brand").click());
        await expect(page).toHaveURL("/");
        // An older, uninstrumented entry has genuine Next state but no index.
        await page.evaluate(() => {
          const { __lobbyNavigationGuard: _index, ...state } = history.state;
          History.prototype.replaceState.call(history, state, "");
        });
        const home = await historySnapshot(page);
        await page.goBack();
        await expect(page.locator(readyStage)).toBeVisible();
        const unexpectedDialogs: string[] = [];
        page.on("dialog", async (dialog) => { unexpectedDialogs.push(dialog.type()); await dialog.dismiss(); });
        await page.goForward();
        await expect(page).toHaveURL("/");
        expect(await historySnapshot(page)).toEqual(home);
        await page.goBack();
        await expect(page).toHaveURL(lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        expect(unexpectedDialogs).toEqual([]);
      });

      test("rapid Back during recovery keeps the original lobby mounted", async ({ page }) => {
        await page.goto("/terms");
        await page.locator(".site-brand").click();
        await expect(page).toHaveURL("/");
        await pushRoute(page, lobbyPath);
        await expect(page.locator(readyStage)).toBeVisible();
        const before = await historySnapshot(page);
        const stage = await page.locator(readyStage).elementHandle();
        await page.evaluate(() => {
          let prompts = 0;
          window.confirm = () => {
            prompts++;
            document.documentElement.dataset.historyGuardPrompts = String(prompts);
            if (prompts === 1) setTimeout(() => history.back(), 0);
            return false;
          };
          history.back();
        });
        await expect(page.locator("html")).toHaveAttribute("data-history-guard-prompts", "1");
        await expect.poll(() => historySnapshot(page)).toEqual(before);
        await page.waitForTimeout(100);
        expect(await historySnapshot(page)).toEqual(before);
        expect(await stage!.evaluate((element) => element.isConnected)).toBe(true);
        await expect(page.locator(readyStage)).toBeVisible();
      });
    }
  });
}
