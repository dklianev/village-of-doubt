import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type Request, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

const families = ["mafia", "werewolves"] as const;
const themes = ["light", "dark"] as const;
const viewports = [
  { width: 320, height: 740 }, { width: 390, height: 844 },
  { width: 768, height: 1024 }, { width: 1440, height: 900 },
];
const previewRoute = "**/api/rooms/ABC234/preview";
const room = {
  code: "ABC234", status: "lobby", family: "mafia", mode: "mafia_free",
  roomVisibility: "private", viewerMembership: "none", canJoinAsPlayer: true, canSpectate: true,
  playerCount: 5, capacity: 10, hostName: "Анна",
  players: [
    { displayName: "Анна", connected: true, ready: true, host: true },
    { displayName: "Борис", connected: true, ready: true, host: false },
    { displayName: "Рада", connected: false, ready: true, host: false },
  ],
};

function roomFor(family: typeof families[number]) {
  return { ...room, family, mode: family === "mafia" ? "mafia_free" : "werewolves_classic" };
}

async function prepare(page: Page, theme: typeof themes[number]) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The unavailable fixture deliberately returns HTTP 503; other console errors still fail.
    if (message.location().url.includes("/api/rooms/ABC234/preview")
      && /Failed to load resource.*503/.test(message.text())) return;
    errors.push(message.text());
  });
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  return errors;
}

async function expectHealth(page: Page, errors: string[]) {
  await expect(page.getByRole("heading", { name: "Покана за масата.", exact: true })).toBeVisible();
  await expect(page.locator("main:visible")).toHaveCount(1);
  expect(await page.locator("nextjs-portal").evaluateAll((portals) => portals.some(
    (portal) => portal.shadowRoot?.querySelector("[data-nextjs-dialog-overlay]"),
  ))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
}

async function expectContainedLayout(page: Page) {
  const overflow = await page.locator([
    ".lobby-invite-details", ".lobby-code-panel", ".lobby-route-card",
    ".lobby-player-preview", ".lobby-player-preview-row", ".lobby-player-chip",
    ".lobby-invite-cta", ".lobby-invite-footer",
  ].join(", ")).evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    return rect.left < -1 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1
      ? [element.className] : [];
  }));
  expect(overflow, "Invitation sections must not overflow or hide oversized contents").toEqual([]);
  for (const control of await page.locator(".lobby-invite-v2").locator("button, a").all()) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    // Firefox can return 43.999969px for a 44px control after scrolling.
    expect(Number(box!.height.toFixed(3))).toBeGreaterThanOrEqual(44);
    const contents = await control.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const rectangles = [...element.querySelectorAll("svg")].map((icon) => icon.getBoundingClientRect());
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      // Button shimmer pseudo-elements contribute to scrollHeight, but are not control content.
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rectangles.push(...range.getClientRects());
      }
      return {
        name: element.getAttribute("aria-label") || element.textContent,
        overflow: rectangles.filter((rect) => rect.left < bounds.left - 1 || rect.right > bounds.right + 1
          || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1).map((rect) => rect.toJSON()),
      };
    });
    expect(contents.overflow, `Content overflows ${contents.name}`).toEqual([]);
  }
}

async function expectRosterLayout(page: Page) {
  const roster = page.getByRole("region", { name: "Първи играчи в стаята" });
  const cta = page.getByRole("navigation", { name: "Действия за стаята" });
  const rosterBox = (await roster.boundingBox())!;
  const ctaBox = (await cta.boundingBox())!;
  const footerBox = (await page.locator(".lobby-invite-footer").boundingBox())!;
  if (page.viewportSize()!.width <= 800) {
    expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(rosterBox.y + 1);
  } else {
    expect(rosterBox.y + rosterBox.height).toBeLessThanOrEqual(ctaBox.y + 1);
  }
  expect(Math.max(ctaBox.y + ctaBox.height, rosterBox.y + rosterBox.height)).toBeLessThanOrEqual(footerBox.y + 1);
  expect(await roster.evaluate((element) => Boolean(element.compareDocumentPosition(
    document.querySelector(".lobby-invite-cta")!,
  ) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const chips = roster.locator(".lobby-player-chip");
  await expect(chips).toHaveCount(3);
  const positions = await chips.evaluateAll((elements) => elements.map((element) => {
    const chip = element.getBoundingClientRect();
    const monogram = element.querySelector("strong")!.getBoundingClientRect();
    return { left: chip.left, right: chip.right, top: monogram.top, width: monogram.width, height: monogram.height };
  }));
  for (let index = 0; index < positions.length; index++) {
    const position = positions[index]!;
    expect(position.width).toBeGreaterThan(0);
    expect(Math.abs(position.width - position.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(position.top - positions[0]!.top)).toBeLessThanOrEqual(1);
    if (index > 0) expect(position.left).toBeGreaterThanOrEqual(positions[index - 1]!.right - 1);
  }
}

async function expectNoRoomActions(page: Page, redacted = true) {
  const invitation = page.locator(".lobby-invite-v2");
  await expect(invitation.getByRole("link", { name: /Към играта|Наблюдавай|Върни се в играта|Продължи да наблюдаваш/ })).toHaveCount(0);
  await expect(invitation.getByRole("button", { name: /Копирай|Сподели/ })).toHaveCount(0);
  if (redacted) {
    await expect(invitation.locator(".lobby-player-preview")).toHaveCount(0);
    await expect(invitation).not.toContainText(/Анна|Борис|Рада|Домакин:|И още|Поканата остава активна/);
    await expect(invitation).not.toHaveAttribute("data-family");
    await expect(invitation.getByRole("link", { name: "Въведи друг код", exact: true })).toHaveAttribute("href", "/join");
  }
}

async function expectKeyboardFocus(control: Locator) {
  await expect(control).toBeFocused();
  expect(await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  })).toBe(true);
}

test.describe("invitation SPA chrome restoration", () => {
  test.use({ viewport: { width: 1487, height: 1058 } });

  for (const theme of themes) {
    test(`restores homepage styles with the invitation retained after logo and Back ${theme}`, async ({ page }, testInfo) => {
      const errors = await prepare(page, theme);
      await page.route(previewRoute, (route) => route.fulfill({ json: roomFor("werewolves") }));
      const chrome = page.locator('.site-chrome[data-version="v2"]');
      const invitation = page.locator("main.lobby-invitation-page");
      const pendingSessions = new Set<Request>();
      const sessionFailures: string[] = [];
      let completedSessions = 0;
      const isSessionRequest = (request: Request) => new URL(request.url()).pathname === "/api/auth/get-session";
      page.on("request", (request) => { if (isSessionRequest(request)) pendingSessions.add(request); });
      page.on("requestfinished", (request) => {
        if (!isSessionRequest(request)) return;
        pendingSessions.delete(request);
        completedSessions++;
      });
      page.on("requestfailed", (request) => {
        if (!isSessionRequest(request)) return;
        pendingSessions.delete(request);
        sessionFailures.push(request.failure()?.errorText ?? "Session request failed");
      });
      const expectSessionReady = async () => {
        // Do not unload the baseline document while its mocked auth bootstrap is still in flight.
        await expect(chrome.locator(".auth-chip-slot")).toHaveAttribute("data-auth-state", "guest");
        await expect.poll(() => pendingSessions.size).toBe(0);
        expect(completedSessions).toBeGreaterThan(0);
        expect(sessionFailures).toEqual([]);
      };
      const readChrome = () => page.evaluate(() => {
        const styles = (selector: string, properties: string[]) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing chrome element: ${selector}`);
          const computed = getComputedStyle(element);
          return Object.fromEntries(properties.map((property) => [property, computed.getPropertyValue(property)]));
        };
        return {
          body: styles("body", ["background-color"]),
          header: styles('.site-chrome[data-version="v2"]', ["height", "min-height", "padding-left", "padding-right", "background-color", "border-bottom-color"]),
          wordmark: styles(".site-brand-wordmark", ["width", "height"]),
          familyLink: styles(".site-family-link", ["font-size"]),
          more: styles(".site-more-trigger", ["font-size"]),
          join: styles(".site-join-link", ["font-size"]),
          footer: styles(".site-footer", ["position", "margin-top", "padding-top", "padding-bottom", "font-size", "line-height", "background-color", "border-top-color"]),
          footerLinks: styles(".site-footer > div", ["gap"]),
          footerTagline: styles(".site-footer > p", ["font-size", "line-height", "font-weight", "letter-spacing"]),
        };
      });

      await page.goto("/");
      await expect(chrome).toHaveAttribute("data-route", "/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() => document.fonts.ready);
      await expectSessionReady();
      const baseline = await readChrome();
      await testInfo.attach(`homepage-chrome-baseline-${theme}`, { body: JSON.stringify(baseline, null, 2), contentType: "application/json" });

      await page.goto("/lobby/ABC234?visualAuth=1&mode=werewolves_classic");
      await expect(page.getByRole("link", { name: "Към играта", exact: true })).toBeVisible();
      await expect(chrome).toHaveAttribute("data-route", "/lobby/ABC234");
      await expect.poll(() => chrome.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(66, 1);

      for (const stage of ["logo", "back-then-logo"]) {
        await expectSessionReady();
        if (stage === "back-then-logo") {
          await page.goBack();
          await expect(chrome).toHaveAttribute("data-route", "/lobby/ABC234");
          await expect(invitation).toBeVisible();
          await expect.poll(() => chrome.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(66, 1);
          await expectSessionReady();
          await expectHealth(page, errors);
        }
        await page.getByRole("link", { name: "Сенките, начало", exact: true }).click();
        await expect(page).toHaveURL("/");
        await expect(chrome).toHaveAttribute("data-route", "/");
        // Activity keeps the old route mounted; its presence must not style the active homepage.
        await expect(invitation).toHaveCount(1);
        await expect(invitation).toBeHidden();
        await expect(page.locator("main:visible")).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        await expectSessionReady();
        await expect.poll(readChrome, { message: `Homepage chrome must match its fresh baseline after ${stage}` }).toEqual(baseline);
        await testInfo.attach(`homepage-chrome-${stage}-${theme}`, { body: JSON.stringify(await readChrome(), null, 2), contentType: "application/json" });
      }
      expect((await new AxeBuilder({ page }).include(".site-chrome").include(".site-footer").analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
});

test.describe("invitation reference geometry 1487x1058", () => {
  test.use({ viewport: { width: 1487, height: 1058 } });

  for (const theme of themes) {
    test(`synthetic Mila, Kamen and Anna match the reference anchors ${theme}`, async ({ page }, testInfo) => {
      const errors = await prepare(page, theme);
      await page.route(previewRoute, (route) => route.fulfill({ json: {
        ...roomFor("werewolves"), playerCount: 6, capacity: 12, hostName: "Мила",
        players: [
          { displayName: "Мила", connected: true, ready: true, host: true },
          { displayName: "Камен", connected: true, ready: true, host: false },
          { displayName: "Анна", connected: true, ready: false, host: false },
        ],
      } }));
      await page.goto("/lobby/ABC234?visualAuth=1&mode=werewolves_classic");
      const entry = page.getByRole("link", { name: "Към играта", exact: true });
      await expect(entry).toHaveAttribute("href", "/play/ABC234?mode=werewolves_classic");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".lobby-invite-v2")).toHaveAttribute("data-family", "werewolves");
      await expect(page.locator(".lobby-room-status-line p")).toHaveText(["Чака играчи", "6 от 12 места заети"]);
      await expect(page.locator(".lobby-room-host")).toHaveText("Домакин: Мила.");
      await expect(page.locator(".lobby-player-name")).toHaveText(["Мила", "Камен", "Анна"]);
      await expect(page.locator(".lobby-player-chip em")).toHaveText(["домакин", "готов", "в стаята"]);
      await expect(page.locator(".lobby-more-players")).toHaveText("И още 3 в стаята.");
      await expect(page.locator(".lobby-invite-hero-copy h1 br")).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);

      const geometry = await page.evaluate(() => {
        const box = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing reference element: ${selector}`);
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
        };
        const heading = document.querySelector(".lobby-invite-hero-copy h1")!;
        const textOverflow = [...document.querySelectorAll(".lobby-invite-hero-copy h1, .lobby-invite-hero-copy p")].flatMap((element) => {
          const bounds = element.getBoundingClientRect();
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            if ([...range.getClientRects()].some((rect) => rect.left < bounds.left - 2 || rect.right > bounds.right + 2)) {
              return [element.textContent];
            }
          }
          return [];
        });
        return {
          heading: box(".lobby-invite-hero-copy h1"),
          headingLineHeight: parseFloat(getComputedStyle(heading).lineHeight),
          intro: box(".lobby-invite-hero-copy p:last-child"),
          code: box(".lobby-code-panel"),
          copy: box(".lobby-code-panel button"),
          status: box(".lobby-room-status-line"),
          host: box(".lobby-room-host"),
          rosterLabel: box(".lobby-player-preview .lobby-route-kicker"),
          medals: [...document.querySelectorAll(".lobby-player-chip strong")].map((element) => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }),
          entry: box(".lobby-invite-cta .btn-primary"),
          observer: box(".lobby-invite-cta .btn-secondary"),
          footer: box(".lobby-invite-footer"),
          footerControls: [...document.querySelectorAll(".lobby-invite-footer button, .lobby-invite-footer a")].map((element) => {
            const rect = element.getBoundingClientRect();
            return { y: rect.y, height: rect.height };
          }),
          siteFooter: box(".site-footer"), textOverflow,
          page: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollY },
        };
      });
      await testInfo.attach(`reference-geometry-${theme}`, { body: JSON.stringify(geometry, null, 2), contentType: "application/json" });
      await testInfo.attach(`reference-viewport-${theme}`, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });

      // Anchors from the approved 1487x1058 reference; compare layout boxes, not painted glyph pixels.
      const near = (name: string, actual: number, target: number, tolerance = 4) => {
        expect.soft(Math.abs(actual - target), `${name}: ${actual}px; reference ${target}px +/- ${tolerance}px`).toBeLessThanOrEqual(tolerance);
      };
      near("heading left", geometry.heading.x, 131, 6);
      near("two-line heading center", geometry.heading.y + geometry.heading.height / 2, 213, 6);
      near("two-line heading height", geometry.heading.height, 132, 6);
      near("heading stays on two lines", geometry.heading.height, geometry.headingLineHeight * 2, 2);
      expect(geometry.heading.bottom).toBeLessThanOrEqual(geometry.intro.y + 2);
      expect(geometry.intro.bottom).toBeLessThanOrEqual(geometry.code.y - 2);
      expect(geometry.textOverflow).toEqual([]);
      near("code left", geometry.code.x, 131);
      near("code top", geometry.code.y, 370);
      near("code bottom", geometry.code.bottom, 484);
      expect(geometry.copy.y).toBeGreaterThanOrEqual(geometry.code.y);
      expect(geometry.copy.bottom).toBeLessThanOrEqual(geometry.code.bottom);
      expect(geometry.code.bottom).toBeLessThanOrEqual(geometry.status.y);
      expect(geometry.status.bottom).toBeLessThanOrEqual(geometry.host.y + 2);
      expect(geometry.host.bottom).toBeLessThanOrEqual(geometry.rosterLabel.y);
      near("roster label center", geometry.rosterLabel.y + geometry.rosterLabel.height / 2, 589, 6);
      expect(geometry.medals).toHaveLength(3);
      for (const [index, medal] of geometry.medals.entries()) {
        near(`medal ${index + 1} top`, medal.y, 614);
        near(`medal ${index + 1} size`, medal.width, 52, 2);
        expect(geometry.rosterLabel.bottom).toBeLessThanOrEqual(medal.y + 2);
      }
      near("primary CTA left", geometry.entry.x, 131);
      near("primary CTA top", geometry.entry.y, 736);
      near("primary CTA height", geometry.entry.height, 58, 2);
      near("observer CTA top", geometry.observer.y, geometry.entry.y, 2);
      near("observer CTA height", geometry.observer.height, geometry.entry.height, 2);
      expect(geometry.entry.right).toBeLessThanOrEqual(geometry.observer.x);
      near("footer left", geometry.footer.x, 131, 6);
      near("footer action row center", geometry.footer.y + geometry.footer.height / 2, 841, 6);
      expect(geometry.footerControls).toHaveLength(3);
      for (const control of geometry.footerControls) {
        near("footer controls stay on one row", control.y + control.height / 2, geometry.footer.y + geometry.footer.height / 2, 2);
      }
      expect(geometry.footer.bottom).toBeLessThanOrEqual(geometry.siteFooter.y);
      expect(geometry.siteFooter.bottom).toBeLessThanOrEqual(1059);
      expect(geometry.page.scrollY).toBe(0);
      expect(geometry.page.width).toBeLessThanOrEqual(1487);
      expect(geometry.page.height).toBeLessThanOrEqual(1059);
      await expectRosterLayout(page);
      await expectContainedLayout(page);
      await expectHealth(page, errors);
    });
  }
});

for (const theme of themes) {
  for (const family of families) {
    const preview = roomFor(family);
    const playHref = `/play/ABC234?mode=${preview.mode}`;
    const spectatorHref = `${playHref}&spectator=1`;
    const backLabel = `Въведи друг код за ${family === "mafia" ? "Мафия" : "Върколак"}`;
    const inviteUrl = `/lobby/ABC234?visualAuth=1&mode=${family === "mafia" ? "werewolves_classic" : "mafia_sport"}`;

    test.describe(`invitation ${family} ${theme}`, () => {
      for (const width of [320, 390, 768, 1487]) {
        test(`200% text keeps action labels and icons inside their buttons ${width}px`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height: width === 1487 ? 1058 : 844 });
          const errors = await prepare(page, theme);
          await page.route(previewRoute, (route) => route.fulfill({ json: preview }));
          await page.goto(inviteUrl);
          const entry = page.getByRole("link", { name: "Към играта", exact: true });
          const observer = page.getByRole("link", { name: "Наблюдавай", exact: true });
          await expect(entry).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          await page.locator(".lobby-invite-v2").evaluate((invitation) => {
            // Simulate text-only enlargement, leaving viewport, icons and control geometry unchanged.
            const sizes = [...invitation.querySelectorAll<HTMLElement>("*")]
              .filter((element) => element instanceof HTMLElement)
              .map((element) => {
                const style = getComputedStyle(element);
                return { element, fontSize: parseFloat(style.fontSize), lineHeight: style.lineHeight };
              });
            for (const { element, fontSize, lineHeight } of sizes) {
              element.style.fontSize = `${fontSize * 2}px`;
              if (lineHeight !== "normal") element.style.lineHeight = `${parseFloat(lineHeight) * 2}px`;
            }
          });
          await expect(entry).toHaveAttribute("href", playHref);
          await expect(observer).toHaveAttribute("href", spectatorHref);
          await expectContainedLayout(page);
          if (width === 390 || width === 1487) {
            const first = (await entry.boundingBox())!;
            const second = (await observer.boundingBox())!;
            expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
          }
          await observer.scrollIntoViewIfNeeded();
          await expect(observer).toBeInViewport({ ratio: 1 });
          await observer.focus();
          await expectKeyboardFocus(observer);
          await expectHealth(page, errors);
          await testInfo.attach(`enlarged-actions-${family}-${theme}-${width}`, {
            body: await page.locator(".lobby-invite-cta").screenshot(), contentType: "image/png",
          });
        });
      }

      for (const viewport of [...viewports, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
        test.describe(`${viewport.width}px`, () => {
          test.use({ viewport });
          test("unframed scene, responsive entry order and horizontal public roster", async ({ page }, testInfo) => {
            const errors = await prepare(page, theme);
            await page.route(previewRoute, (route) => route.fulfill({ json: preview }));
            await page.goto(inviteUrl);
            const entry = page.getByRole("link", { name: "Към играта", exact: true });
            await expect(entry).toHaveAttribute("href", playHref);
            await page.evaluate(() => document.fonts.ready);
            await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
            await expect(page.locator(".lobby-invite-v2")).toHaveAttribute("data-family", family);
            await expect(page.getByRole("link", { name: "Наблюдавай", exact: true })).toHaveAttribute("href", spectatorHref);
            await expect(page.getByText("И още 2 в стаята.")).toBeVisible();
            await expect(page.getByText("извън линия", { exact: true })).toBeVisible();
            await expect(page.locator(".lobby-route-card")).toContainText("5 от 10 места заети");
            await expect(page.locator(".lobby-route-card")).toContainText("Домакин: Анна.");
            await expect(page.locator(".lobby-invite-paper")).toHaveCount(0);
            const details = page.locator(".lobby-invite-details");
            await expect(details).toBeVisible();
            const geometry = await details.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return { left: rect.left, right: rect.right, radius: style.borderRadius, shadow: style.boxShadow,
                background: style.backgroundColor, image: style.backgroundImage,
                borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth] };
            });
            expect(geometry.left).toBeGreaterThanOrEqual(15);
            expect(viewport.width - geometry.right).toBeGreaterThanOrEqual(15);
            expect(geometry.radius).toBe("0px");
            expect(geometry.shadow).toBe("none");
            expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
            expect(geometry.image).toBe("none");
            expect(geometry.borders).toEqual(["0px", "0px", "0px", "0px"]);
            if (viewport.width >= 1024) expect(geometry.right).toBeLessThanOrEqual(viewport.width * 0.65);
            await expectRosterLayout(page);
            await expectContainedLayout(page);
            if (viewport.height >= 740) await expect(entry).toBeInViewport({ ratio: 1 });
            await entry.scrollIntoViewIfNeeded();
            await expect(entry).toBeInViewport({ ratio: 1 });
            const footer = page.locator(".lobby-invite-footer");
            await expect(footer.getByRole("button", { name: "Сподели поканата", exact: true })).toBeVisible();
            const back = footer.getByRole("link", { name: backLabel, exact: true });
            await expect(back).toHaveAttribute("href", family === "mafia" ? "/mafia/join" : "/werewolf/join");
            await expect(back).toHaveText("Друг код");
            const art = await page.locator(".lobby-invite-scene").evaluate(async (element) => {
              const urls = Array.from(getComputedStyle(element).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g), (match) => match[1]!);
              const image = new Image();
              if (!urls[0]) throw new Error("Invitation scene has no background image");
              image.src = urls[0];
              await image.decode();
              const scene = element.getBoundingClientRect();
              return { url: image.src, width: image.naturalWidth, height: image.naturalHeight,
                sceneWidth: scene.width, sceneHeight: scene.height, articleWidth: element.parentElement!.getBoundingClientRect().width };
            });
            if (family === "werewolves") {
              expect(new URL(art.url).pathname).toBe(`/game-art/invitation/werewolf-threshold-v1-${theme}.webp`);
              expect([art.width, art.height]).toEqual([1487, 1058]);
            } else {
              expect(art.url).toContain("/mafia/");
              expect(art.url).toContain("bg-lobby-tavern");
              expect(art.width).toBeGreaterThanOrEqual(960);
            }
            expect(art.sceneHeight).toBeGreaterThan(0);
            expect(Math.abs(art.sceneWidth - art.articleWidth)).toBeLessThanOrEqual(1);
            await expectHealth(page, errors);
            if (viewport.width === 320 || viewport.width === 390 || viewport.width === 1440) {
              await page.evaluate(() => window.scrollTo(0, 0));
              await testInfo.attach(`invite-${family}-${theme}-${viewport.width}`, { body: await page.screenshot({ fullPage: viewport.width !== 320 }), contentType: "image/png" });
            }
          });
        });
      }

      for (const viewport of viewports) {
        test.describe(`long names ${viewport.width}px`, () => {
          test.use({ viewport });
          test("keeps long public names and monograms inside the horizontal roster", async ({ page }, testInfo) => {
            const errors = await prepare(page, theme);
            const names = ["Александра Александрова", "КонстантинополскиГост", "Радостина Димитрова"];
            await page.route(previewRoute, (route) => route.fulfill({ json: {
              ...preview, hostName: names[0],
              players: preview.players.map((player, index) => ({ ...player, displayName: names[index] })),
            } }));
            await page.goto(inviteUrl);
            await expect(page.getByRole("link", { name: "Към играта", exact: true })).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            const roster = page.getByRole("region", { name: "Първи играчи в стаята" });
            for (const name of names) await expect(roster.getByText(name, { exact: true })).toBeVisible();
            await expect(page.locator(".lobby-route-card")).toContainText(`Домакин: ${names[0]}`);
            await expectRosterLayout(page);
            await expectContainedLayout(page);
            await expectHealth(page, errors);
            if (viewport.width === 320 || viewport.width === 1440) {
              await testInfo.attach(`invite-long-names-${family}-${theme}-${viewport.width}`, { body: await page.screenshot({ fullPage: viewport.width !== 320 }), contentType: "image/png" });
            }
          });
        });
      }

      for (const width of [320, 1440]) {
        test(`keyboard and canonical copy ${width}px`, async ({ page, browserName }) => {
          await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
          const errors = await prepare(page, theme);
          const copied: string[] = [];
          await page.exposeFunction("recordInvitationCopy", (value: string) => { copied.push(value); });
          await page.addInitScript(() => {
            Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
            Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
              writeText: (value: string) => (window as unknown as { recordInvitationCopy: (value: string) => Promise<void> }).recordInvitationCopy(value),
            } });
          });
          await page.route(previewRoute, (route) => route.fulfill({ json: preview }));
          await page.goto(`${inviteUrl}&redirect=private#fragment`);
          const copyCode = page.getByRole("button", { name: "Копирай кода", exact: true });
          await expect(copyCode).toBeVisible();
          await copyCode.focus();
          await expectKeyboardFocus(copyCode);
          await page.keyboard.press("Enter");
          await expect.poll(() => copied).toEqual(["ABC234"]);
          for (const control of [
            page.getByRole("link", { name: "Към играта", exact: true }),
            page.getByRole("link", { name: "Наблюдавай", exact: true }),
            page.getByRole("button", { name: "Сподели поканата", exact: true }),
          ]) {
            const isLink = await control.evaluate((element) => element.tagName === "A");
            // WebKit's native tab policy skips links, as in the auth recovery tests.
            if (browserName === "webkit" && isLink) {
              expect(await control.evaluate((element) => (element as HTMLElement).tabIndex)).toBeGreaterThanOrEqual(0);
              await control.focus();
            } else await page.keyboard.press("Tab");
            await expectKeyboardFocus(control);
          }
          const canonicalUrl = `${new URL(page.url()).origin}/lobby/ABC234`;
          await page.keyboard.press("Enter");
          await expect.poll(() => copied).toEqual(["ABC234", canonicalUrl]);
          await page.keyboard.press("Tab");
          await expectKeyboardFocus(page.getByRole("button", { name: "Копирай линка", exact: true }));
          await page.keyboard.press("Space");
          await expect.poll(() => copied).toEqual(["ABC234", canonicalUrl, canonicalUrl]);
          const back = page.getByRole("link", { name: backLabel, exact: true });
          if (browserName === "webkit") {
            expect(await back.evaluate((element) => (element as HTMLElement).tabIndex)).toBeGreaterThanOrEqual(0);
            await back.focus();
          } else await page.keyboard.press("Tab");
          await expectKeyboardFocus(back);
          await expectContainedLayout(page);
          await expectHealth(page, errors);
        });
      }

      test("eligibility, full rooms and returning players stay server-authoritative", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const errors = await prepare(page, theme);
        let reply: Record<string, unknown> = preview;
        await page.route(previewRoute, (route) => route.fulfill({ json: reply }));
        const cases = [
          { status: "lobby", playerCount: 10, viewerMembership: "none", canJoinAsPlayer: false, canSpectate: true, entry: null, observe: "Наблюдавай", summary: "Стаята е пълна" },
          { status: "lobby", playerCount: 10, viewerMembership: "participant", canJoinAsPlayer: true, canSpectate: false, entry: "Върни се в играта", observe: null, summary: "10 от 10 места заети" },
          { status: "in_game", playerCount: 10, viewerMembership: "participant", canJoinAsPlayer: true, canSpectate: false, entry: "Върни се в играта", observe: null, summary: "Играта вече върви" },
          { status: "in_game", playerCount: 5, viewerMembership: "none", canJoinAsPlayer: false, canSpectate: true, entry: null, observe: "Наблюдавай", summary: "Играта вече върви" },
          { status: "in_game", playerCount: 5, viewerMembership: "spectator", canJoinAsPlayer: false, canSpectate: true, entry: null, observe: "Продължи да наблюдаваш", summary: "Играта вече върви" },
          { status: "lobby", playerCount: 5, viewerMembership: "none", canJoinAsPlayer: false, canSpectate: false, entry: null, observe: null, summary: "5 от 10 места заети" },
        ];
        for (const { entry, observe, summary, ...eligibility } of cases) {
          reply = { ...preview, ...eligibility };
          await page.goto(inviteUrl);
          await expect(page.locator(".lobby-route-card")).toContainText(summary);
          const entryLink = page.getByRole("link", { name: /^(Към играта|Върни се в играта)$/ });
          const observerLink = page.getByRole("link", { name: /^(Наблюдавай|Продължи да наблюдаваш)$/ });
          if (entry) {
            await expect(entryLink).toHaveAccessibleName(entry);
            await expect(entryLink).toHaveAttribute("href", playHref);
            await expect(entryLink).toHaveClass(/btn-primary/);
          } else await expect(entryLink).toHaveCount(0);
          if (observe) {
            await expect(observerLink).toHaveAccessibleName(observe);
            await expect(observerLink).toHaveAttribute("href", spectatorHref);
            await expect(observerLink).toHaveClass(/btn-primary/);
          } else await expect(observerLink).toHaveCount(0);
          if (!entry && !observe) await expectNoRoomActions(page, false);
          await expectContainedLayout(page);
          await expectHealth(page, errors);
        }
      });

      test("missing, unavailable and finished rooms do not invent activity or admission", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 740 });
        const errors = await prepare(page, theme);
        let reply: Record<string, unknown> = { status: "missing" };
        let responseStatus = 200;
        await page.route(previewRoute, (route) => route.fulfill({ status: responseStatus, json: reply }));
        await page.goto(inviteUrl);
        await expect(page.locator(".lobby-route-card")).toContainText("Тази стая вече не е достъпна");
        await expectNoRoomActions(page);
        await expectHealth(page, errors);
        reply = { status: "unavailable" };
        responseStatus = 503;
        await page.reload();
        await expect(page.locator(".lobby-route-card")).toContainText("Не успяхме да проверим стаята");
        await expectNoRoomActions(page);
        await expectHealth(page, errors);
        reply = preview;
        responseStatus = 200;
        await page.getByRole("button", { name: "Провери отново", exact: true }).click();
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toHaveAttribute("href", playHref);
        await expect(page.locator(".lobby-invite-v2")).toHaveAttribute("data-family", family);
        await expectHealth(page, errors);
        reply = { ...preview, hostName: null, players: [] };
        await page.reload();
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toBeVisible();
        await expect(page.locator(".lobby-player-preview")).toHaveCount(0);
        await expect(page.locator(".lobby-route-card")).not.toContainText(/Домакин:|Анна/);
        await expectHealth(page, errors);
        reply = { ...preview, status: "finished" };
        await page.reload();
        await expect(page.locator(".lobby-route-card")).toContainText("Тази стая вече приключи");
        await expectNoRoomActions(page, false);
        await expect(page.getByRole("link", { name: backLabel, exact: true })).toHaveAttribute("href", family === "mafia" ? "/mafia/join" : "/werewolf/join");
        await expectContainedLayout(page);
        await expectHealth(page, errors);
      });
    });
  }
}
