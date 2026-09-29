import { expect, test, type BrowserContext } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

const accountURL = "/account?visualAuth=1";
const syntheticUser = {
  id: "visual-account-user", name: "Synthetic account", email: "synthetic@example.invalid", emailVerified: true,
};

for (const theme of ["light", "dark"]) {
  test(`authenticated portrait keeps its reserved size while the artwork loads ${theme}`, async ({ page, context, baseURL }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSession(context, new URL(baseURL ?? "http://127.0.0.1:3000").origin, theme);
    let release!: () => void;
    const artworkReady = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/game-art/avatars/**", async (route) => {
      await artworkReady;
      await route.continue();
    });
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const trigger = page.getByRole("button", { name: "Меню на Synthetic account", exact: true });
      await expect(trigger).toBeVisible();
      const slot = trigger.locator(".auth-chip-photo");
      const portrait = slot.locator("[data-avatar-id]");
      await expect(portrait).toHaveAttribute("data-avatar-id", /^portrait-/);
      await page.evaluate(() => document.fonts.ready);
      const before = await slot.boundingBox();
      const portraitBefore = await portrait.boundingBox();
      expect(before!.width).toBeGreaterThanOrEqual(28);
      expect(before!.height).toBeGreaterThanOrEqual(28);
      expect(portraitBefore!.width).toBeGreaterThanOrEqual(24);
      expect(portraitBefore!.height).toBeGreaterThanOrEqual(24);
      release();
      await portrait.evaluate(async (element) => {
        const image = new Image();
        image.src = getComputedStyle(element).getPropertyValue("--avatar-image").match(/url\(['"]?([^'")]+)/)![1]!;
        await image.decode();
        if (image.naturalWidth < 64) throw new Error("Portrait source is missing or undersized");
      });
      expect(await slot.boundingBox()).toEqual(before);
      expect(await portrait.boundingBox()).toEqual(portraitBefore);
      await page.locator("header.site-chrome").screenshot({ path: testInfo.outputPath(`portrait-${theme}.png`), animations: "disabled" });
    } finally {
      release();
    }
  });
}

// This fixture proves document/cache lifecycle, not real login or backend authorization.
async function mockSession(context: BrowserContext, origin: string, theme: string) {
  const state = {
    authenticated: true, rejectSignOut: true as boolean | "network", signOutRequests: 0,
    rejectDelete: true, deleteRequests: 0, guestAccountRequests: 0, documents: 0,
  };
  await context.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    for (const key of ["cookie-consent", "welcome-modal-shown", "tutorial-completed"]) localStorage.setItem(key, "1");
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        const restores = Number(sessionStorage.getItem("account-test-bfcache-restores") ?? "0");
        sessionStorage.setItem("account-test-bfcache-restores", String(restores + 1));
      }
    });
  }, theme);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (request.isNavigationRequest() && request.resourceType() === "document") state.documents += 1;
    if (url.pathname === "/api/auth/get-session") {
      expect(request.method()).toBe("GET");
      return route.fulfill({ json: state.authenticated ? { user: syntheticUser, session: { id: "synthetic-session" } } : null });
    }
    if (url.pathname === "/api/auth/sign-out") {
      expect(request.method()).toBe("POST");
      state.signOutRequests += 1;
      if (state.rejectSignOut === "network") return route.abort("failed");
      if (state.rejectSignOut) return route.fulfill({ status: 503, json: { message: "Synthetic sign-out failure" } });
      state.authenticated = false;
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname === "/api/account/delete") {
      expect(request.method()).toBe("POST");
      expect(request.postDataJSON()).toEqual({ intent: "delete-account" });
      state.deleteRequests += 1;
      if (state.rejectDelete) return route.fulfill({ status: 503, json: { error: "Synthetic deletion failure" } });
      state.authenticated = false;
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: null });
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();
    if (url.pathname === "/account" && !state.authenticated) {
      state.guestAccountRequests += 1;
      // visualAuth bypasses server auth, so explicitly deny it after mocked logout.
      // The assertion must observe this NEW request, not just a guest chrome control.
      return route.fulfill({ status: 401, contentType: "text/html", headers: { "cache-control": "no-store" }, body: "<!doctype html><h1>Synthetic session ended</h1>" });
    }
    return route.continue();
  });
  return state;
}

for (const browserName of ["chromium", "firefox", "webkit"] as const) {
  for (const { width, theme, logoutFrom } of [
    { width: 1440, theme: "light", logoutFrom: "account" },
    { width: 390, theme: "dark", logoutFrom: "home" },
  ]) {
    test(`account hash history ${browserName} ${width}: native modal releases on Back, Forward preserves drafts and Activity scroll`, async ({ playwright, baseURL }, testInfo) => {
      baseURL ??= "http://127.0.0.1:3000";
      const browser = await playwright[browserName].launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
      try {
        const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
        const session = await mockSession(context, new URL(baseURL).origin, theme);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(accountURL);
        await expect(page).toHaveTitle(/Твоето досие/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Визуален играч");
        const chronicle = page.getByRole("tab", { name: "Хроника", exact: true });
        const identity = page.getByRole("tab", { name: "Образ и достъп", exact: true });
        const security = page.getByRole("tab", { name: "Данни и сигурност", exact: true });
        await expect(chronicle).toHaveAttribute("aria-selected", "true");
        await page.getByRole("link", { name: "Редактирай", exact: true }).click();
        await expect(page).toHaveURL(/#account-identity$/);
        await expect(identity).toHaveAttribute("aria-selected", "true");
        await page.locator("#account-name").fill("Synthetic draft");
        await security.click();
        await expect(page).toHaveURL(/#account-security$/);
        await page.getByRole("button", { name: "Изтрий моето досие", exact: true }).click();
        const deleteDialog = page.locator("#account-security dialog");
        await expect(deleteDialog).toBeVisible();
        await expect(deleteDialog).toHaveJSProperty("open", true);
        expect(await deleteDialog.evaluate((element) => element.matches(":modal"))).toBe(true);
        await deleteDialog.getByRole("textbox", { name: "Напиши ИЗТРИЙ за потвърждение" }).fill("ИЗ");

        await page.goBack();
        await expect(page).toHaveURL(new URL(accountURL, baseURL).href);
        await expect(chronicle).toHaveAttribute("aria-selected", "true");
        await expect(page.locator("#account-name")).toBeHidden();
        await expect(deleteDialog).toBeHidden();
        await expect(deleteDialog).toHaveJSProperty("open", false);
        expect(await deleteDialog.evaluate((element) => element.matches(":modal"))).toBe(false);
        // A rendered Chronicle is not enough: a hidden native modal can still make it inert.
        await identity.click();
        await expect(page.locator("#account-name")).toHaveValue("Synthetic draft");
        await expect(identity).toHaveAttribute("aria-selected", "true");
        await chronicle.click();
        await expect(page.getByRole("heading", { name: "Последни вечери", exact: true })).toBeVisible();
        const screenshot = testInfo.outputPath("chronicle-after-back.png");
        await page.screenshot({ path: screenshot });
        await testInfo.attach("chronicle-after-back", { path: screenshot, contentType: "image/png" });
        await page.goForward();
        await expect(page).toHaveURL(/#account-security$/);
        await expect(security).toHaveAttribute("aria-selected", "true");
        await expect(deleteDialog).toBeVisible();
        expect(await deleteDialog.evaluate((element) => element.matches(":modal"))).toBe(true);
        await expect(deleteDialog.getByRole("textbox", { name: "Напиши ИЗТРИЙ за потвърждение" })).toHaveValue("ИЗ");
        await expect(deleteDialog.getByRole("button", { name: "Изтрий завинаги", exact: true })).toBeDisabled();
        await deleteDialog.getByRole("button", { name: "Отказ", exact: true }).click();
        await expect(deleteDialog).toBeHidden();
        await expect(deleteDialog).toHaveJSProperty("open", false);
        await expect(page.getByRole("button", { name: "Изтрий моето досие", exact: true })).toBeFocused();
        await page.getByRole("button", { name: "Изтрий моето досие", exact: true }).click();
        await expect(deleteDialog).toBeVisible();
        await expect(deleteDialog.getByRole("textbox", { name: "Напиши ИЗТРИЙ за потвърждение" })).toHaveValue("");
        await page.keyboard.press("Escape");
        await expect(deleteDialog).toBeHidden();
        await identity.click();
        await expect(identity).toHaveAttribute("aria-selected", "true");
        await expect(page.locator("#account-name")).toHaveValue("Synthetic draft");
        expect(session.deleteRequests).toBe(0);
        expect(session.signOutRequests).toBe(0);

        await page.evaluate(() => document.fonts.ready);
        await page.getByText("Начини за вход", { exact: true }).scrollIntoViewIfNeeded();
        const scroll = await page.evaluate(() => window.scrollY);
        expect(scroll).toBeGreaterThan(0);
        await page.locator('header a[href="/"]').first().click();
        await expect(page).toHaveURL(new URL("/", baseURL).href);
        await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
        await page.goBack();
        await expect(identity).toHaveAttribute("aria-selected", "true");
        await expect(page.locator("#account-name")).toHaveValue("Synthetic draft");
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
        await expect(page.getByText("Начини за вход", { exact: true })).toBeInViewport();
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });

    test(`account logout cache ${browserName} ${width}: failure stays, success from ${logoutFrom} ends the document${width === 1440 ? " without randomUUID" : ""}`, async ({ playwright, baseURL }, testInfo) => {
      baseURL ??= "http://127.0.0.1:3000";
      const browser = await playwright[browserName].launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
      try {
        const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
        const session = await mockSession(context, new URL(baseURL).origin, theme);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const olderAccountURL = `${accountURL}&visualAccount=long#account-identity`;
        await page.goto(olderAccountURL);
        await expect(page.locator("#account-name")).toBeVisible();
        await page.locator("#account-name").fill("Earlier synthetic draft");
        // A hard navigation leaves a distinct, older private document in history.
        await page.goto(accountURL);
        await page.getByRole("link", { name: "Редактирай", exact: true }).click();
        await expect(page.locator("#account-name")).toBeVisible();
        await page.locator("#account-name").fill("Synthetic private draft");
        if (logoutFrom === "home") {
          await page.locator('header a[href="/"]').first().click();
          await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
        }
        await page.evaluate(() => { document.documentElement.dataset.accountSessionDocument = "before-logout"; });
        const beforeLogoutURL = page.url();
        const documentsBeforeLogout = session.documents;
        const revisionBeforeLogout = await page.evaluate(() => localStorage.getItem("auth-logout-revision"));
        await page.getByRole("button", { name: width < 760 ? "Отвори менюто" : "Меню на Synthetic account", exact: true }).click();
        await page.getByRole("button", { name: "Изход", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Излизаш ли от масата?" });
        await dialog.getByRole("button", { name: "Излизам", exact: true }).click();
        await expect(dialog.getByRole("alert")).toContainText("Излизането не успя");
        await expect(page).toHaveURL(beforeLogoutURL);
        expect(session.authenticated).toBe(true);
        expect(session.documents).toBe(documentsBeforeLogout);
        await expect(page.locator("#account-name")).toHaveValue("Synthetic private draft");
        expect(await page.evaluate(() => localStorage.getItem("auth-logout-revision"))).toBe(revisionBeforeLogout);
        await expect(page.locator("#auth-session-ended")).toHaveCount(0);

        session.rejectSignOut = false;
        if (width === 1440) {
          // Remove only this capability after hydration; dev bootstrap also depends on it.
          await page.evaluate(() => Object.defineProperty(crypto, "randomUUID", { configurable: true, value: undefined }));
          expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
        }
        await dialog.getByRole("button", { name: "Опитай отново", exact: true }).click();
        await expect(page).toHaveURL(new URL("/", baseURL).href);
        await expect.poll(() => session.documents).toBeGreaterThan(documentsBeforeLogout);
        if (width < 760) await page.getByRole("button", { name: "Отвори менюто", exact: true }).click();
        await expect(page.locator("[data-auth-state=guest]:visible").first()).toBeVisible();
        if (width < 760) await page.getByRole("button", { name: "Затвори менюто", exact: true }).click();
        await expect(page.locator("html")).not.toHaveAttribute("data-account-session-document", "before-logout");
        await expect(page.locator("#account-name")).toHaveCount(0);
        expect(session.authenticated).toBe(false);
        expect(session.signOutRequests).toBe(2);
        const revisionAfterLogout = await page.evaluate(() => localStorage.getItem("auth-logout-revision"));
        expect(revisionAfterLogout).toBeTruthy();
        expect(revisionAfterLogout).not.toBe(revisionBeforeLogout);

        const requestsBeforeBack = session.guestAccountRequests;
        await page.goBack();
        await expect.poll(() => session.guestAccountRequests).toBeGreaterThan(requestsBeforeBack);
        await expect(page.locator("#account-name")).toHaveCount(0);
        await expect(page.getByText("visual@example.com", { exact: true })).toHaveCount(0);
        // The home-logout path has both the hash and the original account entry.
        if (logoutFrom === "home") {
          await page.goBack();
          await expect(page).toHaveURL(new URL(accountURL, baseURL).href);
          await expect(page.locator("#account-name")).toHaveCount(0);
        }
        const requestsBeforeOlderBack = session.guestAccountRequests;
        await page.goBack();
        await expect(page).toHaveURL(new URL(olderAccountURL, baseURL).href);
        await expect.poll(() => session.guestAccountRequests).toBeGreaterThan(requestsBeforeOlderBack);
        await expect(page.getByRole("heading", { name: "Synthetic session ended" })).toBeVisible();
        await expect(page.locator("#account-name")).toHaveCount(0);
        const nativeRestores = await page.evaluate(() => Number(sessionStorage.getItem("account-test-bfcache-restores") ?? "0"));
        testInfo.annotations.push({ type: "native-bfcache-restores", description: String(nativeRestores) });
        console.log(`${browserName} ${width}: observed native BFCache restores=${nativeRestores}`);
        await page.goForward();
        if (logoutFrom === "home") await page.goForward();
        await page.goForward();
        await expect(page).toHaveURL(new URL("/", baseURL).href);
        await expect(page.locator("#account-name")).toHaveCount(0);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
    test(`account deletion cache ${browserName} ${width}: failure preserves session, success ends document despite sign-out cleanup ${width === 390 ? "network failure" : "503"}`, async ({ playwright, baseURL }, testInfo) => {
      baseURL ??= "http://127.0.0.1:3000";
      const browser = await playwright[browserName].launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
      let release!: () => void;
      const responseGate = new Promise<void>((resolve) => { release = resolve; });
      try {
        const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
        const session = await mockSession(context, new URL(baseURL).origin, theme);
        session.rejectSignOut = width === 390 ? "network" : true;
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const olderAccountURL = `${accountURL}&visualAccount=long#account-identity`;
        await page.goto(olderAccountURL);
        await page.locator("#account-name").fill("Earlier synthetic deletion draft");
        await page.goto(accountURL);
        await page.getByRole("link", { name: "Редактирай", exact: true }).click();
        await page.locator("#account-name").fill("Synthetic deletion draft");
        await page.getByRole("tab", { name: "Данни и сигурност", exact: true }).click();
        await page.getByRole("button", { name: "Изтрий моето досие", exact: true }).click();
        const dialog = page.locator("#account-security dialog");
        const confirmation = dialog.getByRole("textbox", { name: "Напиши ИЗТРИЙ за потвърждение" });
        await confirmation.fill("ИЗТРИЙ");
        await expect.poll(() => page.evaluate(() => localStorage.getItem("auth-logout-revision"))).toBe("0");
        const beforeDeleteURL = page.url();
        const documentsBeforeDelete = session.documents;
        await page.evaluate(() => { document.documentElement.dataset.accountSessionDocument = "before-delete"; });
        await dialog.getByRole("button", { name: "Изтрий завинаги", exact: true }).click();
        await expect(dialog.getByRole("alert")).toHaveText("Synthetic deletion failure");
        await expect(dialog).toBeVisible();
        await expect(confirmation).toHaveValue("ИЗТРИЙ");
        await expect(page.locator("#account-name")).toHaveValue("Synthetic deletion draft");
        await expect(page).toHaveURL(beforeDeleteURL);
        await expect(page.locator("html")).toHaveAttribute("data-account-session-document", "before-delete");
        await expect(page.locator("#auth-session-ended")).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("auth-logout-revision"))).toBe("0");
        expect(session.authenticated).toBe(true);
        expect(session.documents).toBe(documentsBeforeDelete);
        expect(session.deleteRequests).toBe(1);
        expect(session.signOutRequests).toBe(0);

        await page.route(new URL("/", baseURL).href, async (route) => {
          if (route.request().isNavigationRequest()) await responseGate;
          return route.fallback();
        });
        session.rejectDelete = false;
        let recordTerminal!: (snapshot: unknown) => void;
        const terminalSnapshot = new Promise<unknown>((resolve) => { recordTerminal = resolve; });
        await page.exposeFunction("recordTerminalDocument", recordTerminal);
        await page.evaluate(() => {
          const observer = new MutationObserver(() => {
            const notice = document.getElementById("auth-session-ended");
            if (!notice) return;
            observer.disconnect();
            (window as typeof window & { recordTerminalDocument: (snapshot: unknown) => void }).recordTerminalDocument({
              noticeVisible: Boolean(notice.getClientRects().length),
              noticeRole: notice.getAttribute("role"),
              originalModalOpen: document.querySelector<HTMLDialogElement>("#account-security dialog")?.open,
              originalModalRects: document.querySelector("#account-security dialog")?.getClientRects().length,
              privateRects: document.getElementById("account-name")?.getClientRects().length,
            });
          });
          observer.observe(document.body, { childList: true });
        });
        const replacement = page.waitForRequest((request) => request.isNavigationRequest()
          && new URL(request.url()).pathname === "/");
        await dialog.getByRole("button", { name: "Изтрий завинаги", exact: true }).click({ noWaitAfter: true });
        await replacement;
        // Capture from the old document before navigation pauses browser automation commands.
        await expect(terminalSnapshot).resolves.toEqual({ noticeVisible: true, noticeRole: "alertdialog", originalModalOpen: false, originalModalRects: 0, privateRects: 0 });
        expect(session.authenticated).toBe(false);
        expect(session.deleteRequests).toBe(2);
        expect(session.signOutRequests).toBe(1);
        release();
        await expect(page).toHaveURL(new URL("/", baseURL).href);
        await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
        await expect.poll(() => session.documents).toBeGreaterThan(documentsBeforeDelete);
        await expect(page.locator("html")).not.toHaveAttribute("data-account-session-document", "before-delete");
        await expect(page.locator("#account-name")).toHaveCount(0);
        const revision = await page.evaluate(() => localStorage.getItem("auth-logout-revision"));
        expect(revision).toBeTruthy();
        expect(revision).not.toBe("0");

        for (const target of [accountURL, olderAccountURL]) {
          const requestsBeforeBack = session.guestAccountRequests;
          const denied = page.waitForResponse((response) => response.request().isNavigationRequest()
            && new URL(response.url()).pathname === "/account" && response.status() === 401);
          await page.goBack();
          await denied;
          await expect(page).toHaveURL(new URL(target, baseURL).href);
          await expect.poll(() => session.guestAccountRequests).toBeGreaterThan(requestsBeforeBack);
          await expect(page.getByRole("heading", { name: "Synthetic session ended", exact: true })).toBeVisible();
          await expect(page.locator("#account-name")).toHaveCount(0);
          await expect(page.getByText("visual@example.com", { exact: true })).toHaveCount(0);
          await expect(page.locator("#account-security dialog")).toHaveCount(0);
        }
        const nativeRestores = await page.evaluate(() => Number(sessionStorage.getItem("account-test-bfcache-restores") ?? "0"));
        testInfo.annotations.push({ type: "native-bfcache-restores", description: String(nativeRestores) });
        await testInfo.attach("deleted-account-back-denied", { body: await page.screenshot(), contentType: "image/png" });
        expect(errors).toEqual([]);
      } finally {
        release();
        await browser.close();
      }
    });
  }

  // Pair viewports/themes per surface instead of multiplying every permutation.
  for (const { overlay, width, theme } of [
    { overlay: "logout", width: 1440, theme: "light" },
    { overlay: "drawer", width: 390, theme: "dark" },
    { overlay: "native-delete", width: 1440, theme: "dark" },
    { overlay: "native-delete", width: 390, theme: "light" },
  ] as const) {
    test(`account stale overlay ${browserName} ${width} ${theme} ${overlay}: persisted pageshow covers private UI and leaves an operable home link`, async ({ playwright, baseURL }, testInfo) => {
      baseURL ??= "http://127.0.0.1:3000";
      const homeURL = new URL("/", baseURL).href;
      const browser = await playwright[browserName].launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
      let release!: () => void;
      const responseGate = new Promise<void>((resolve) => { release = resolve; });
      try {
        const context = await browser.newContext({ baseURL, viewport: { width, height: 844 }, reducedMotion: "reduce", serviceWorkers: "block" });
        const session = await mockSession(context, new URL(baseURL).origin, theme);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${accountURL}#account-identity`);
        await page.locator("#account-name").fill("Synthetic stale private draft");
        await expect.poll(() => page.evaluate(() => localStorage.getItem("auth-logout-revision"))).toBe("0");
        if (overlay === "native-delete") {
          await page.getByRole("tab", { name: "Данни и сигурност", exact: true }).click();
          await page.getByRole("button", { name: "Изтрий моето досие", exact: true }).click();
          await page.getByRole("textbox", { name: "Напиши ИЗТРИЙ за потвърждение" }).fill("ИЗ");
          expect(await page.locator("#account-security dialog").evaluate((element) => element.matches(":modal"))).toBe(true);
        } else {
          await page.getByRole("button", { name: overlay === "drawer" ? "Отвори менюто" : "Меню на Synthetic account", exact: true }).click();
          if (overlay === "logout") await page.getByRole("button", { name: "Изход", exact: true }).click();
        }
        const oldOverlay = page.locator(overlay === "logout" ? "[data-ds-dialog]"
          : overlay === "drawer" ? "[data-ds-sheet]" : "#account-security dialog");
        await expect(oldOverlay).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        let holdFirstNavigation = true;
        await page.route(homeURL, async (route) => {
          if (!route.request().isNavigationRequest() || !holdFirstNavigation) return route.fallback();
          holdFirstNavigation = false;
          await responseGate;
          // Abort only the pending replacement, retaining the same terminal document for QA.
          return route.abort("aborted");
        });
        session.authenticated = false;
        const replacement = page.waitForRequest((request) => request.isNavigationRequest() && request.url() === homeURL);
        const immediate = await page.evaluate(() => {
          localStorage.setItem("auth-logout-revision", "synthetic-later-overlay-logout");
          document.documentElement.dataset.accountSessionDocument = "stale-overlay";
          window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
          const notice = document.querySelector<HTMLDialogElement>("#auth-session-ended");
          const home = notice?.querySelector("a");
          const oldSurfaces = [...document.querySelectorAll("main, header.site-chrome, [data-ds-dialog], [data-ds-sheet], #account-security dialog")];
          return {
            rootDisplay: document.documentElement.style.display,
            privateRects: document.getElementById("account-name")?.getClientRects().length,
            oldSurfacesHidden: oldSurfaces.every((element) => element.getClientRects().length === 0),
            oldNativeModals: document.querySelectorAll("dialog:modal:not(#auth-session-ended)").length,
            noticeVisible: Boolean(notice?.getClientRects().length),
            noticeModal: notice?.matches(":modal"),
            fallbackHref: home?.getAttribute("href"),
            homeFocused: document.activeElement === home,
          };
        });
        expect(immediate).toEqual({
          rootDisplay: "", privateRects: 0, oldSurfacesHidden: true, oldNativeModals: 0,
          noticeVisible: true, noticeModal: true, fallbackHref: "/", homeFocused: true,
        });
        const pendingRequest = await replacement;
        const aborted = page.waitForEvent("requestfailed", { predicate: (request) => request === pendingRequest });
        release();
        await aborted;
        await expect(page.locator("html")).toHaveAttribute("data-account-session-document", "stale-overlay");
        const notice = page.getByRole("alertdialog", { name: "Сесията ти е приключила", exact: true });
        const home = notice.getByRole("link", { name: "Към началото", exact: true });
        await page.keyboard.press("Escape");
        await expect.poll(() => page.evaluate(() => ({
          modal: document.getElementById("auth-session-ended")?.matches(":modal"),
          visible: Boolean(document.getElementById("auth-session-ended")?.getClientRects().length),
          homeFocused: document.activeElement === document.querySelector("#auth-session-ended a"),
        }))).toEqual({ modal: true, visible: true, homeFocused: true });

        // Observe trusted activation after the replacement failed, retaining the terminal document.
        // The listener removes itself after both input paths; the final click navigates normally.
        await page.evaluate(() => {
          const element = document.querySelector<HTMLAnchorElement>("#auth-session-ended a")!;
          let activations = 0;
          function observe(event: Event) {
            event.preventDefault();
            if (!event.isTrusted) return;
            element.setAttribute(activations === 0 ? "data-keyboard-activated" : "data-pointer-activated", "true");
            if (++activations === 2) element.removeEventListener("click", observe);
          }
          element.addEventListener("click", observe);
        });
        await page.keyboard.press("Enter");
        await expect.poll(() => page.evaluate(() => document.querySelector("#auth-session-ended a")?.getAttribute("data-keyboard-activated"))).toBe("true");
        const center = await page.evaluate(() => {
          const element = document.querySelector<HTMLAnchorElement>("#auth-session-ended a")!;
          const rect = element.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          return { x, y, reachable: element.contains(document.elementFromPoint(x, y)) };
        });
        expect(center.reachable).toBe(true);
        await page.mouse.click(center.x, center.y);
        await expect.poll(() => page.evaluate(() => document.querySelector("#auth-session-ended a")?.getAttribute("data-pointer-activated"))).toBe("true");
        // Safari does not focus links on pointer activation; explicitly verify focus can still enter.
        await home.focus();
        await expect(home).toBeFocused();
        await expect(notice).toBeVisible();
        await expect(oldOverlay).toBeHidden();
        await expect(page.getByText("visual@example.com", { exact: true }).and(page.locator(":visible"))).toHaveCount(0);
        const accessibility = await new AxeBuilder({ page }).include("#auth-session-ended").analyze();
        expect(accessibility.violations).toEqual([]);
        const screenshotPath = testInfo.outputPath("session-ended.png");
        await page.screenshot({ path: screenshotPath });
        await testInfo.attach("session-ended-after-navigation-abort", { path: screenshotPath, contentType: "image/png" });
        const navigation = page.waitForRequest((request) => request.isNavigationRequest() && request.url() === homeURL);
        await home.click();
        await navigation;
        await expect(page).toHaveURL(homeURL);
        await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
        await expect(page.locator("html")).not.toHaveAttribute("data-account-session-document", "stale-overlay");
        await expect(page.locator("#account-name")).toHaveCount(0);
        expect(session.deleteRequests).toBe(0);
        expect(session.signOutRequests).toBe(0);
        expect(errors).toEqual([]);
        testInfo.annotations.push({ type: "pageshow", description: "Synthetic persisted event; no claim of a native BFCache restore." });
      } finally {
        release();
        await browser.close();
      }
    });
  }

  test(`account synthetic persisted pageshow ${browserName}: unchanged offline restores stay, later logout leaves`, async ({ playwright, baseURL }) => {
    baseURL ??= "http://127.0.0.1:3000";
    const browser = await playwright[browserName].launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
    let release!: () => void;
    const responseGate = new Promise<void>((resolve) => { release = resolve; });
    try {
      const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
      const session = await mockSession(context, new URL(baseURL).origin, "light");
      const page = await context.newPage();
      await page.goto(`${accountURL}#account-identity`);
      await expect(page.locator("#account-name")).toBeVisible();
      await expect(page.getByRole("button", { name: "Меню на Synthetic account", exact: true })).toBeVisible();
      await page.locator("#account-name").fill("Offline synthetic draft");
      // Inject the lifecycle event explicitly: dev HMR may prevent native BFCache.
      const documentsBeforeRestore = session.documents;
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      await expect(page.locator("#account-name")).toBeVisible();
      await expect(page.locator("#account-name")).toHaveValue("Offline synthetic draft");
      expect(session.documents).toBe(documentsBeforeRestore);
      expect(await page.locator("html").evaluate((element) => element.style.display)).toBe("");
      await context.setOffline(false);

      // A changed marker represents logout in another document, not a real auth flow.
      session.authenticated = false;
      await page.evaluate(() => {
        localStorage.setItem("auth-logout-revision", "synthetic-later-logout");
        document.documentElement.dataset.accountSessionDocument = "before-logout";
      });
      await context.route(new URL("/", baseURL).href, async (route) => {
        await responseGate;
        return route.fallback();
      });
      const revalidation = page.waitForRequest((request) => request.isNavigationRequest()
        && new URL(request.url()).pathname === "/");
      expect(await page.evaluate(() => {
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        return {
          rootDisplay: document.documentElement.style.display,
          privateRects: document.getElementById("account-name")?.getClientRects().length,
          noticeVisible: Boolean(document.getElementById("auth-session-ended")?.getClientRects().length),
          fallbackHref: document.querySelector("#auth-session-ended a")?.getAttribute("href"),
        };
      })).toEqual({ rootDisplay: "", privateRects: 0, noticeVisible: true, fallbackHref: "/" });
      await revalidation;
      release();
      await expect(page).toHaveURL(new URL("/", baseURL).href);
      await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
      await expect(page.locator("html")).not.toHaveAttribute("data-account-session-document", "before-logout");
      await expect(page.locator("#account-name")).toHaveCount(0);

      // Even a different logout marker must leave a guest-only public document alone.
      const guestDocuments = session.documents;
      await context.setOffline(true);
      await page.evaluate(() => {
        localStorage.setItem("auth-logout-revision", "synthetic-another-logout");
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
      await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
      expect(await page.locator("html").evaluate((element) => element.style.display)).toBe("");
      expect(session.documents).toBe(guestDocuments);
    } finally {
      release();
      await browser.close();
    }
  });
}
