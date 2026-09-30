import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page, type Route, type TestInfo } from "playwright/test";
import { parseStatusSnapshot, type StatusSnapshot } from "../lib/status-health-shared";

const STATUS_SNAPSHOT = {
  lastCheckedAt: "2026-09-20T10:00:00.000Z",
  services: [
    { id: "web", name: "Уеб приложение", description: "Синтетична проверка на страниците.", status: "ok", icon: "web" },
    { id: "game-server", name: "Игрови сървър", description: "Синтетична проверка на стаите.", status: "ok", icon: "game" },
    { id: "database", name: "База данни", description: "Синтетична проверка на историята.", status: "ok", icon: "database" },
    { id: "redis", name: "Защита на заявките", description: "Синтетична проверка на ограниченията.", status: "ok", icon: "cache" },
    { id: "auth-google", name: "Вход с Google", description: "Входът не се проверява автоматично.", status: "unknown", icon: "auth" },
    { id: "auth-discord", name: "Вход с Discord", description: "Входът не се проверява автоматично.", status: "unknown", icon: "auth" },
    { id: "email", name: "Имейл услуга", description: "Доставката не се проверява автоматично.", status: "unknown", icon: "email" },
  ],
} satisfies StatusSnapshot;

const ROUTES = [
  { path: "/faq", heading: "Помощ" },
  { path: "/privacy", heading: "Поверителност" },
  { path: "/terms", heading: "Условия за ползване" },
  { path: "/report", heading: "Подай сигнал" },
  { path: "/status", heading: "Състояние на услугите" },
] as const;
const VIEWPORTS = [
  { width: 320, height: 740 }, { width: 390, height: 844 },
  { width: 768, height: 1024 }, { width: 1440, height: 900 },
] as const;

const test = base.extend<{ supportSafety: void }>({
  supportSafety: [async ({ page, context, colorScheme }, use, testInfo) => {
    const runtimeErrors: string[] = [];
    const unexpectedWrites: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      // Mocked HTTP failures are expected; hydration and runtime exceptions are not.
      if (/hydration|hydrating|didn't match|uncaught|unhandled|TypeError|ReferenceError|maximum update depth/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });
    await context.addInitScript((theme) => {
      localStorage.setItem("werewolf-theme", theme);
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
      localStorage.setItem("tutorial-completed", "1");
    }, colorScheme === "dark" ? "dark" : "light");
    await context.route("**/*", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        unexpectedWrites.push(`${request.method()} ${pathname}`);
        await route.fulfill({ status: 503, json: { error: "Synthetic test blocked an unexpected write." } });
      } else if (pathname === "/api/auth/get-session") {
        await route.fulfill({ json: null });
      } else if (pathname === "/api/status") {
        await route.fulfill({ json: STATUS_SNAPSHOT });
      } else if (pathname === "/api/account/export") {
        await route.fulfill({ status: 503, json: { error: "Synthetic export unavailable." } });
      } else {
        await route.continue();
      }
    });
    await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
    try {
      await use();
    } finally {
      if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
        await attachScreenshot(page, testInfo, "support-failure");
      }
      expect.soft(runtimeErrors, "No browser runtime or hydration errors").toEqual([]);
      expect.soft(unexpectedWrites, "Every mutation must be explicitly intercepted by its test").toEqual([]);
    }
  }, { auto: true }],
});

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

async function ready(page: Page, path: string, heading: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  await expect(page.locator(".auth-chip-slot").first()).toHaveAttribute("data-auth-state", "guest");
  await page.evaluate(() => document.fonts.ready);
}

async function noOverflow(page: Page) {
  const geometry = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      main: main.clientWidth,
      mainScroll: main.scrollWidth,
    };
  });
  expect(geometry.document, "Document must fit the viewport").toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.mainScroll, "Main content must not clip horizontal overflow").toBeLessThanOrEqual(geometry.main + 1);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled", caret: "initial" }),
    contentType: "image/png",
  });
}

async function auditState(page: Page, testInfo: TestInfo, name: string) {
  await expect(page.locator(".auth-chip-slot").first()).toHaveAttribute("data-auth-state", "guest");
  await page.evaluate(() => document.fonts.ready);
  await attachScreenshot(page, testInfo, name);
  await noOverflow(page);
  const audit = await new AxeBuilder({ page }).include("main").analyze();
  // Keep accessibility failures visible while still exercising the rest of a recovery flow.
  expect.soft(audit.violations, `${name}: main accessibility`).toEqual([]);
}

async function legalAnchors(page: Page, label: string) {
  const navigation = page.getByRole("navigation", { name: label });
  await expect(navigation).toBeVisible();
  for (const link of await navigation.getByRole("link").all()) {
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^#[a-z][a-z-]+$/);
    const target = page.locator(href!);
    await expect(target).toHaveCount(1);
    await expect(target).toBeVisible();
    await expect(target).toHaveAttribute("tabindex", "-1");
    expect(await target.evaluate((node) => node.closest("details:not([open]), [hidden]"))).toBeNull();
  }
}

async function seedStatus(page: Page) {
  const previous = await page.locator(".status-hero-time").getAttribute("datetime");
  const snapshot = { ...STATUS_SNAPSHOT, lastCheckedAt: new Date(Date.parse(previous!) + 1000).toISOString() };
  await page.route("**/api/status", (route) => route.fulfill({ json: snapshot }));
  await page.getByRole("button", { name: "Опресни състоянието сега", exact: true }).click();
  await expect(page.locator(".status-hero-time")).toHaveAttribute("datetime", snapshot.lastCheckedAt);
  await expect(page.locator(".status-tile")).toHaveCount(7);
  return snapshot;
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of VIEWPORTS) {
    test.describe(`support matrix ${theme} ${viewport.width}`, () => {
      test.use({ viewport, colorScheme: theme });
      for (const route of ROUTES) {
        test(`${route.path} structure, overflow and accessibility`, async ({ page }, testInfo) => {
          await ready(page, route.path, route.heading);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveCount(1);
          if (route.path === "/privacy") {
            const title = page.getByRole("heading", { level: 1, name: route.heading, exact: true });
            const titleLines = await title.evaluate((node) => node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight));
            expect(titleLines, "The one-word heading must not orphan its last letter").toBeLessThan(1.5);
            await legalAnchors(page, "Съдържание на политиката");
            await expect(page.locator("#privacy-data")).toHaveCount(0);
          } else if (route.path === "/terms") {
            await legalAnchors(page, "Съдържание на условията");
            await expect(page.locator(".terms-annex-body")).toHaveCount(6);
            for (const section of await page.locator(".terms-annex-body").all()) await expect(section).toBeVisible();
          } else if (route.path === "/report") {
            await expect(page.getByRole("region", { name: "Подаване на сигнал" })).toBeVisible();
            await expect(page.getByRole("radio")).toHaveCount(5);
            await expect(page.locator(".report-wizard-progress-label")).toContainText("Стъпка 1 от 4");
          } else if (route.path === "/faq") {
            await expect(page.getByRole("searchbox", { name: "Търсене в често задавани въпроси" })).toBeVisible();
            if (viewport.width <= 768) await expect(page.getByRole("combobox", { name: "Тема" })).toBeVisible();
            else await expect(page.getByRole("button", { name: "Всички", exact: true })).toHaveAttribute("aria-pressed", "true");
          } else {
            await seedStatus(page);
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await auditState(page, testInfo, `${route.path.slice(1)}-${theme}-${viewport.width}`);
        });
      }
    });
  }

  for (const viewport of [VIEWPORTS[1], VIEWPORTS[3]]) {
    test.describe(`support flows ${theme} ${viewport.width}`, () => {
      test.use({ viewport, colorScheme: theme });

      test("report requires review, preserves the draft through failure and retries explicitly", async ({ page }, testInfo) => {
        const posts: unknown[] = [];
        const attemptKeys: (string | undefined)[] = [];
        const pending: Route[] = [];
        await page.route("**/api/report", async (route) => {
          expect(route.request().method()).toBe("POST");
          posts.push(route.request().postDataJSON());
          attemptKeys.push(route.request().headers()["idempotency-key"]);
          pending.push(route);
        });
        const description = "Синтетичен сигнал за проверка на формата. Не описва реална игра.";
        const evidence = "/faq; синтетичен сценарий без лични данни";
        await ready(page, "/report", "Подай сигнал");
        await page.getByRole("radio", { name: /Технически проблем/ }).check();
        await page.getByRole("button", { name: "Напред", exact: true }).press("Enter");
        await page.getByRole("button", { name: "Напред", exact: true }).click();
        await expect(page.getByLabel("Описание", { exact: true })).toBeFocused();
        await expect(page.locator(".report-wizard").getByRole("alert")).toContainText("поне 20 символа");
        await page.getByLabel("Описание", { exact: true }).fill(description);
        await page.getByLabel(/Страница, браузър и стъпки/).fill(evidence);
        await page.getByRole("button", { name: "Напред", exact: true }).click();
        await page.getByRole("radio", { name: /С имейл/ }).check();
        await page.getByLabel("Твоят имейл", { exact: true }).fill("synthetic-support@example.test");
        await page.getByLabel("Твоят имейл", { exact: true }).press("Enter");
        await expect(page.getByText("Преглед преди изпращане.", { exact: true })).toBeVisible();
        expect(posts, "Enter from identity advances to review, never sends").toEqual([]);
        await page.getByRole("button", { name: "Назад", exact: true }).click();
        await page.getByRole("radio", { name: /Анонимно/ }).check();
        await page.getByRole("button", { name: "Напред", exact: true }).press("Enter");
        await expect(page.getByText("Преглед преди изпращане.", { exact: true })).toBeFocused();
        await expect(page.locator(".report-review")).toContainText(description);
        await expect(page.locator(".report-review")).not.toContainText("synthetic-support@example.test");
        await page.locator(".report-wizard form").evaluate((form: HTMLFormElement) => form.requestSubmit());
        expect(posts, "An unqualified form submit is not explicit confirmation").toEqual([]);
        await auditState(page, testInfo, "report-review");
        await page.getByRole("button", { name: "Изпрати сигнал", exact: true }).click();
        await expect.poll(() => pending.length).toBe(1);
        await expect(page.getByRole("button", { name: "Изпращаме...", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Назад", exact: true })).toBeDisabled();
        expect(posts).toEqual([{ type: "bug", body: description, evidence, email: null }]);
        await pending.shift()!.fulfill({ status: 503, json: { error: "Синтетична грешка. Опитай отново." } });
        await expect(page.locator(".report-wizard").getByRole("alert")).toBeFocused();
        await expect(page.locator(".report-review")).toContainText(description);
        await auditState(page, testInfo, "report-failure");
        await page.getByRole("button", { name: "Опитай отново", exact: true }).click();
        await expect.poll(() => pending.length).toBe(1);
        expect(posts).toHaveLength(2);
        expect(posts[1]).toEqual(posts[0]);
        expect(attemptKeys[0]).toMatch(/^\d{13}\.[a-f0-9]{64}$/);
        expect(attemptKeys[1]).toBe(attemptKeys[0]);
        await pending.shift()!.fulfill({ json: { referenceId: "СИГ-0123456789" } });
        await expect(page.getByRole("heading", { name: "Сигналът е изпратен.", exact: true })).toBeFocused();
        await expect(page.locator(".report-success")).toContainText("СИГ-0123456789");
        await expect(page.locator(".report-success")).toContainText("Сигналът е анонимен.");
        await auditState(page, testInfo, "report-retried");
      });

      test("status failed refresh keeps seven stale services and accepts a valid retry", async ({ page }, testInfo) => {
        expect(parseStatusSnapshot(STATUS_SNAPSHOT)).toEqual(STATUS_SNAPSHOT);
        await ready(page, "/status", "Състояние на услугите");
        const seeded = await seedStatus(page);
        const pending: Route[] = [];
        await page.route("**/api/status", (route) => { pending.push(route); });
        await page.getByRole("button", { name: "Опресни състоянието сега", exact: true }).click();
        await expect.poll(() => pending.length).toBe(1);
        await expect(page.locator(".status-hero-refresh")).toBeDisabled();
        await pending.shift()!.fulfill({ status: 503, json: { error: "Synthetic refresh failure." } });
        await expect(page.locator(".status-page")).toHaveAttribute("data-stale", "true");
        await expect(page.getByRole("main").getByRole("alert")).toContainText("Обновяването не успя");
        await expect(page.getByRole("heading", { name: "Последни получени данни", exact: true })).toBeVisible();
        await expect(page.locator(".status-hero-time")).toHaveAttribute("datetime", seeded.lastCheckedAt);
        await expect(page.locator(".status-tile")).toHaveCount(7);
        await expect(page.locator(".status-tile[data-status=ok]")).toHaveCount(4);
        await expect(page.locator(".status-tile[data-status=unknown]")).toHaveCount(3);
        await auditState(page, testInfo, "status-stale");
        await page.getByRole("button", { name: "Опитай отново", exact: true }).click();
        await expect.poll(() => pending.length).toBe(1);
        const recovered: StatusSnapshot = {
          lastCheckedAt: new Date(Date.parse(seeded.lastCheckedAt) + 60_000).toISOString(),
          services: STATUS_SNAPSHOT.services.map((service) => service.id === "database"
            ? { ...service, status: "degraded", detail: "Синтетична проверка: забавяне." }
            : { ...service }),
        };
        expect(parseStatusSnapshot(recovered)).toEqual(recovered);
        await pending.shift()!.fulfill({ json: recovered });
        await expect(page.locator(".status-page")).toHaveAttribute("data-stale", "false");
        await expect(page.locator(".status-hero-time")).toHaveAttribute("datetime", recovered.lastCheckedAt);
        await expect(page.locator(".status-tile")).toHaveCount(7);
        await expect(page.locator(".status-hero-status")).toHaveAttribute("data-overall", "degraded");
        await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Опресни състоянието сега", exact: true })).toBeEnabled();
        await auditState(page, testInfo, "status-retried");
      });

      test("terms contact is directly accessible on a fresh load and reload", async ({ page }, testInfo) => {
        await ready(page, "/terms#contact", "Условия за ползване");
        const contact = page.locator("#contact");
        await expect(contact).toBeInViewport();
        await expect(contact.getByRole("link", { name: "страницата за сигнал", exact: true })).toHaveAttribute("href", "/report");
        await legalAnchors(page, "Съдържание на условията");
        const response = await page.reload({ waitUntil: "domcontentloaded" });
        expect(response?.ok()).toBe(true);
        expect(await response!.text()).toContain('id="contact"');
        await expect(page).toHaveURL(/\/terms#contact$/);
        await expect(contact).toBeInViewport();
        await expect(contact.locator(".terms-annex-body")).toBeVisible();
        await auditState(page, testInfo, "terms-contact-reloaded");
      });

      test("privacy synthetic export failure stays actionable on retry", async ({ page }, testInfo) => {
        let attempts = 0;
        await page.route("**/api/account/export**", async (route) => {
          expect(route.request().method()).toBe("GET");
          attempts += 1;
          await route.fulfill({ status: 503, json: { error: "Synthetic export unavailable." } });
        });
        await ready(page, "/privacy?visualAuth=1#privacy-data", "Поверителност");
        const preview = page.locator("#privacy-data");
        await expect(preview).toContainText("visual@example.com");
        await expect(preview.getByRole("heading", { name: "Обобщение на твоите данни.", exact: true })).toBeVisible();
        const download = preview.getByRole("button", { name: /Изтегли моите данни/ });
        await download.click();
        await expect(preview.getByRole("alert")).toContainText("Не успяхме да подготвим данните");
        await expect(download).toBeEnabled();
        expect(attempts).toBe(1);
        await auditState(page, testInfo, "privacy-export-failed");
        await download.click();
        await expect.poll(() => attempts).toBe(2);
        await expect(download).toBeEnabled();
        await expect(preview.getByRole("alert")).toBeVisible();
        await noOverflow(page);
      });
    });
  }

  test.describe(`support FAQ mobile ${theme}`, () => {
    test.use({ viewport: VIEWPORTS[1], colorScheme: theme });
    test("category, cross-category search, empty clear and a direct question", async ({ page }, testInfo) => {
      await ready(page, "/faq", "Помощ");
      const category = page.getByRole("combobox", { name: "Тема" });
      const search = page.getByRole("searchbox", { name: "Търсене в често задавани въпроси" });
      await category.selectOption("privacy");
      await expect(page.locator(".faq-hearth-section")).toHaveCount(1);
      await expect(page.locator(".faq-hearth-section")).toHaveAttribute("data-category", "privacy");
      await search.fill("минималната конфигурация");
      await expect(category).toHaveValue("all");
      await expect(page.getByRole("button", { name: "Каква е минималната конфигурация?", exact: true })).toBeVisible();
      await search.fill("synthetic-no-matching-answer-7f31");
      await expect(page.getByRole("heading", { name: "Няма намерени отговори", exact: true })).toBeVisible();
      await expect(page.locator(".faq-hearth-item")).toHaveCount(0);
      await auditState(page, testInfo, "faq-search-empty");
      await page.locator(".faq-hearth-empty").getByRole("button", { name: /Изчисти търсенето/ }).click();
      await expect(search).toHaveValue("");
      await expect(search).toBeFocused();
      await expect(category).toHaveValue("all");
      await expect(page.locator(".faq-hearth-section")).toHaveCount(5);
      await ready(page, "/faq?q=minimum-setup", "Помощ");
      const question = page.locator("#faq-minimum-setup");
      await expect(question.getByRole("button", { name: "Каква е минималната конфигурация?", exact: true })).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#faq-answer-minimum-setup")).toBeVisible();
      await expect(question).toBeInViewport();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#faq-answer-minimum-setup")).toBeVisible();
      await expect(question).toBeInViewport();
      await auditState(page, testInfo, "faq-direct-question");
    });
  });
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`support enlarged text ${theme}`, () => {
    test.use({ viewport: VIEWPORTS[1], colorScheme: theme });
    for (const route of ROUTES) {
      test(`${route.path} stays readable at 200% text size`, async ({ page }, testInfo) => {
        await ready(page, route.path, route.heading);
        await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
        if (route.path === "/faq") {
          const firstQuestion = page.locator(".faq-hearth-item-handle").first();
          await firstQuestion.press("Enter");
          await expect(firstQuestion).toHaveAttribute("aria-expanded", "true");
          await expect(firstQuestion).toBeFocused();
          await expect(page.locator(".faq-hearth-item-answer").first()).toBeVisible();
        }
        await auditState(page, testInfo, `${route.path.slice(1)}-large-text-${theme}`);
      });
    }
  });
}

test.describe("support terms without JavaScript", () => {
  test.use({ javaScriptEnabled: false, viewport: VIEWPORTS[1] });
  test("contact and every formal clause remain readable without hydration", async ({ page }, testInfo) => {
    await page.goto("/terms#contact", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#contact")).toBeInViewport();
    await expect(page.locator(".terms-annex-body")).toHaveCount(6);
    for (const section of await page.locator(".terms-annex-body").all()) await expect(section).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#contact")).toBeInViewport();
    await attachScreenshot(page, testInfo, "terms-contact-no-javascript");
    await noOverflow(page);
  });
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`support audit fixes ${theme}`, () => {
    test.use({ colorScheme: theme, viewport: { width: 1280, height: 900 } });

    test("FAQ preserves search entered while scripts are still loading", async ({ page }, testInfo) => {
      let release!: () => void;
      const scripts = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/_next/static/chunks/**", async (route) => {
        if (new URL(route.request().url()).pathname.endsWith(".js")) await scripts;
        await route.continue();
      });
      try {
        await page.goto("/faq", { waitUntil: "commit" });
        await page.getByRole("searchbox").fill("имейл");
      } finally {
        release();
      }
      await expect(page.locator(".auth-chip-slot").first()).toHaveAttribute("data-auth-state", "guest");
      await expect(page.getByRole("searchbox")).toHaveValue("имейл");
      await expect(page.locator(".faq-hearth-item")).not.toHaveCount(30);
      await page.locator(".faq-hearth-item-handle").first().click();
      await expect(page.getByRole("searchbox")).toHaveValue("имейл");
      await auditState(page, testInfo, "faq-early-search");
    });

    test("FAQ keyboard navigation fits short windows and enlarged text", async ({ page }, testInfo) => {
      await ready(page, "/faq", "Помощ");
      const toolbar = page.locator(".faq-hearth-toolbar");
      await expect(toolbar).toHaveAttribute("data-sticky", "true");
      for (const height of [400, 480]) {
        await page.setViewportSize({ width: 1280, height });
        await expect(toolbar).toHaveAttribute("data-sticky", "false");
        await page.evaluate(() => window.scrollTo(0, 900));
        await page.getByRole("button", { name: "Технически", exact: true }).focus();
        await page.keyboard.press("Tab");
        const privacy = page.getByRole("button", { name: "Поверителност и контакт", exact: true });
        await expect(privacy).toBeFocused();
        await expect(privacy).toBeInViewport({ ratio: 1 });
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Първа вечер?" })).toBeInViewport({ ratio: 1 });
      }
      await page.setViewportSize({ width: 1280, height: 700 });
      await expect(toolbar).toHaveAttribute("data-sticky", "true");
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await expect(toolbar).toHaveAttribute("data-sticky", "false");
      await auditState(page, testInfo, "faq-large-sidebar-text");
    });

    test("FAQ prints readable answers without interactive page furniture", async ({ page }, testInfo) => {
      await ready(page, "/faq", "Помощ");
      await page.emulateMedia({ media: "print" });
      await expect(page.locator(".faq-hearth-toolbar")).toBeHidden();
      await expect(page.locator(".faq-hearth-banner")).toBeHidden();
      await expect(page.locator(".faq-hearth-item-footer").first()).toBeHidden();
      for (const answer of await page.locator(".faq-hearth-item-answer-shell").all()) {
        await expect(answer).toBeVisible();
      }
      await attachScreenshot(page, testInfo, "faq-print");
      await page.emulateMedia({ media: "screen" });
      await expect(page.locator(".faq-hearth-item-answer-shell").first()).toBeHidden();
    });

    test("status cannot recover from older or equal cached observations", async ({ page }, testInfo) => {
      await ready(page, "/status", "Състояние на услугите");
      const seeded = await seedStatus(page);
      for (const delta of [-1000, 0]) {
        await page.route("**/api/status", (route) => route.fulfill({ json: {
          ...seeded, lastCheckedAt: new Date(Date.parse(seeded.lastCheckedAt) + delta).toISOString(),
        } }));
        await page.locator(".status-hero-refresh").click();
        await expect(page.locator(".status-hero-refresh")).toBeEnabled();
        await expect(page.locator(".status-page")).toHaveAttribute("data-stale", "true");
        await expect(page.locator(".status-hero-time")).toHaveAttribute("datetime", seeded.lastCheckedAt);
      }
      const recovered = { ...seeded, lastCheckedAt: new Date(Date.parse(seeded.lastCheckedAt) + 1000).toISOString() };
      await page.route("**/api/status", (route) => route.fulfill({ json: recovered }));
      await page.locator(".status-hero-refresh").click();
      await expect(page.locator(".status-page")).toHaveAttribute("data-stale", "false");
      await expect(page.locator(".status-hero-time")).toHaveAttribute("datetime", recovered.lastCheckedAt);
      await auditState(page, testInfo, "status-monotonic-recovery");
    });

    test("privacy export keeps its destination through the guest sign-in redirect", async ({ page }) => {
      await ready(page, "/privacy", "Поверителност");
      // The visual server always serves the account fixture (ACCOUNT_DASHBOARD_FIXTURE), so the guest
      // hop through /sign-in is covered by app/__tests__/account-page.test.tsx; here the link must
      // carry the export intent and land on the export section.
      await expect(page.getByRole("link", { name: "Изтегли данни →", exact: true }))
        .toHaveAttribute("href", "/account?section=data-export#account-data-export");
      await ready(page, "/account?visualAuth=1&section=data-export#account-data-export", "Визуален играч");
      await expect(page.getByRole("tab", { name: "Данни и сигурност" })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#account-data-export")).toBeInViewport();
    });
  });
}

for (const timezoneId of ["Pacific/Pago_Pago", "Pacific/Kiritimati"]) {
  test.describe(`privacy canonical date ${timezoneId}`, () => {
    test.use({ timezoneId, viewport: VIEWPORTS[1] });
    test("synthetic registration date remains stable through hydration and export interaction", async ({ page }) => {
      await ready(page, "/privacy?visualAuth=1#privacy-data", "Поверителност");
      const date = page.locator(".privacy-data-row").filter({ hasText: "Регистриран" });
      await expect(date).toContainText("10 март 2026");
      await page.locator("#privacy-data").getByRole("button", { name: /Изтегли моите данни/ }).click();
      await expect(page.locator("#privacy-data").getByRole("alert")).toBeVisible();
      await expect(date).toContainText("10 март 2026");
    });
  });
}

for (const recovery of ["timeout", "navigation"]) {
test(`report ${recovery} keeps the draft and reuses its key on an explicit retry`, async ({ page }, testInfo) => {
  await ready(page, "/report?visualStep=review", "Подай сигнал");
  if (recovery === "timeout") await page.clock.install();
  const attempts: { key: string | undefined; body: unknown }[] = [];
  let held: Route | undefined;
  await page.route("**/api/report", async (route) => {
    attempts.push({ key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON() });
    if (attempts.length === 1) held = route;
    else await route.fulfill({ json: { ok: true, referenceId: "СИГ-0123456789" } });
  });
  await page.getByRole("button", { name: "Изпрати сигнал", exact: true }).click();
  await expect.poll(() => attempts.length).toBe(1);
  if (recovery === "timeout") await page.clock.fastForward(16_000);
  else {
    await page.locator('a[href="/"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL("/");
    await page.goBack();
  }
  await expect(page.getByRole("button", { name: "Опитай отново", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Назад", exact: true })).toBeEnabled();
  await expect(page.locator(".report-review")).toContainText("Играч използва обиди");
  await held!.abort().catch(() => {});
  await page.getByRole("button", { name: "Опитай отново", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Сигналът е изпратен.", exact: true })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await auditState(page, testInfo, `report-${recovery}-retried`);
});
}
