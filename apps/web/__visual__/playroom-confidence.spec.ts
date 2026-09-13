import { expect, test, type Page } from "playwright/test";

async function openRoom(page: Page, query: string, mobile = true, theme = "dark", viewport?: { width: number; height: number }) {
  await page.setViewportSize(viewport ?? (mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }));
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("cookie-consent", "1");
  }, theme);
  await page.goto(`/play/VISUAL?visualGame=1&${query}`);
  await expect(page.locator('.play-stage[data-layout-ready="true"], .play-stage-takeover')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("mobile command leaves a row of targets visible", async ({ page }, testInfo) => {
  await openRoom(page, "phase=night&family=mafia&players=10&role=commissioner&timer=90");
  await page.getByRole("button", { name: "Покажи личния ход" }).click();
  const dock = await page.locator(".play-action-dock").boundingBox();
  const targets = await page.locator("button[data-seat-token]").evaluateAll((nodes) => nodes.map((node) => {
    const { top, bottom } = node.getBoundingClientRect();
    return { top, bottom };
  }));
  await testInfo.attach("mobile-command-geometry", {
    body: JSON.stringify({ dock, targets }, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ path: testInfo.outputPath("mobile-command.png") });
  expect(dock).not.toBeNull();
  expect(targets.some((target) => target.top >= 0 && target.bottom < dock!.y)).toBe(true);
  expect(dock!.height).toBeLessThan(844 * 0.5);
});

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`desktop persistent role and unified interaction frame ${family} ${theme}`, async ({ page }, testInfo) => {
      const role = family === "mafia" ? "commissioner" : "seer";
      await openRoom(page, `phase=voting&family=${family}&role=${role}&players=10&voteTally=full&timer=90`, false, theme);
      const personal = page.locator(".play-primary-column > .play-personal-area");
      const card = personal.locator(".role-card[data-private-dossier]");
      const stage = page.locator(".play-primary-column > .play-stage");
      const interaction = page.locator(".play-interaction-column");
      const dock = interaction.locator(":scope > .play-action-dock");
      const rail = interaction.locator(":scope > .play-side-rail");
      await expect(card).toBeVisible();
      await expect(card.locator("details > summary")).toHaveText("За ролята");
      await expect(card.locator("details")).not.toHaveAttribute("open");
      await expect(dock).toBeVisible();
      await expect(rail).toBeVisible();
      await expect(dock.locator("[data-private-dossier]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Отвори тайното досие" })).toHaveCount(0);
      await expect(stage.locator("[data-private-dossier]")).toHaveCount(0);

      await stage.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first().click();
      const confirm = dock.getByRole("button", { name: /Потвърди гласа/ });
      await expect(confirm).toBeEnabled();
      const events = rail.getByRole("tabpanel", { name: "Събития", exact: true });
      await expect(events).toBeVisible();
      const stageBox = (await stage.boundingBox())!;
      const personalBox = (await personal.boundingBox())!;
      const interactionBox = (await interaction.boundingBox())!;
      const eventsBox = (await events.boundingBox())!;
      const hideBox = (await personal.getByRole("button", { name: "Скрий ролята", exact: true }).boundingBox())!;
      const headerBox = (await card.locator(".role-card-header").boundingBox())!;
      const headerTextBoxes = await card.locator(".role-card-header h2, .role-card-header p").evaluateAll((elements) => (
        elements.flatMap((element) => {
          // Measure the text, not the unused space in a full-width header block.
          const range = document.createRange();
          range.selectNodeContents(element);
          return [...range.getClientRects()].map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
        })
      ));
      const visibleEventsHeight = Math.max(0,
        Math.min(eventsBox.y + eventsBox.height, interactionBox.y + interactionBox.height, 900)
        - Math.max(eventsBox.y, interactionBox.y, 0),
      );
      const frameStyles = await interaction.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat),
          radius: parseFloat(style.borderTopLeftRadius),
        };
      });
      const screenshot = testInfo.outputPath("persistent-role-desktop.png");
      await page.screenshot({ path: screenshot, fullPage: false });
      await testInfo.attach("persistent-role-desktop", { path: screenshot, contentType: "image/png" });
      await testInfo.attach("desktop-layout-geometry", {
        body: JSON.stringify({ stageBox, personalBox, interactionBox, eventsBox, visibleEventsHeight, hideBox, headerBox, headerTextBoxes, frameStyles }, null, 2),
        contentType: "application/json",
      });

      expect.soft(personalBox.y, "The persistent role belongs below the desktop table").toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
      expect.soft(stageBox.x + stageBox.width).toBeLessThanOrEqual(interactionBox.x + 1);
      expect.soft(interactionBox.y + interactionBox.height, "The unified right panel must fit the initial viewport").toBeLessThanOrEqual(900);
      expect.soft(visibleEventsHeight, "Events need at least 150px of visible reading space").toBeGreaterThanOrEqual(150);
      expect.soft(frameStyles.borders).toEqual([1, 1, 1, 1]);
      expect.soft(frameStyles.radius).toBeGreaterThan(0);
      for (const panel of [dock, rail]) {
        const frame = await panel.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth, style.borderTopLeftRadius].map(parseFloat);
        });
        expect.soft(frame, "Dock and rail share an outer frame, with only an internal divider").toEqual([0, 0, 0, 0]);
      }
      expect(headerTextBoxes.length).toBeGreaterThan(0);
      for (const textBox of headerTextBoxes) {
        const overlapWidth = Math.max(0, Math.min(hideBox.x + hideBox.width, textBox.x + textBox.width) - Math.max(hideBox.x, textBox.x));
        const overlapHeight = Math.max(0, Math.min(hideBox.y + hideBox.height, textBox.y + textBox.height) - Math.max(hideBox.y, textBox.y));
        expect.soft(overlapWidth * overlapHeight, "The hide button must not cover the role header text").toBe(0);
      }
      await expect.soft(confirm).toBeInViewport({ ratio: 1 });
      await expect.soft(card).toBeInViewport();
      expect.soft(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test(`short desktop 1366x768 keeps the role below the table without overflow or overlap ${family} ${theme}`, async ({ page }, testInfo) => {
      const viewport = { width: 1366, height: 768 };
      const role = family === "mafia" ? "commissioner" : "seer";
      await openRoom(page, `phase=voting&family=${family}&role=${role}&players=10&voteTally=full&timer=90`, false, theme, viewport);
      const personal = page.locator(".play-primary-column > .play-personal-area");
      const card = personal.locator(".role-card[data-private-dossier]");
      const stage = page.locator(".play-primary-column > .play-stage");
      const interaction = page.locator(".play-interaction-column");
      await expect(card).toBeVisible();
      await expect(interaction).toBeVisible();
      const stageBox = (await stage.boundingBox())!;
      const personalBox = (await personal.boundingBox())!;
      const interactionBox = (await interaction.boundingBox())!;
      const hide = personal.getByRole("button", { name: "Скрий ролята", exact: true });
      await expect(hide).toBeVisible();
      const headerOverlaps = await personal.evaluate((element) => {
        const toggle = element.querySelector<HTMLButtonElement>(".play-personal-toggle")!.getBoundingClientRect();
        return [...element.querySelectorAll(".role-card-header h2, .role-card-header p")].filter((label) => {
          const range = document.createRange();
          range.selectNodeContents(label);
          return [...range.getClientRects()].some((rect) => (
            Math.min(toggle.right, rect.right) > Math.max(toggle.left, rect.left)
            && Math.min(toggle.bottom, rect.bottom) > Math.max(toggle.top, rect.top)
          ));
        }).map((label) => label.textContent);
      });
      const screenshot = testInfo.outputPath("short-desktop.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach("short-desktop", { path: screenshot, contentType: "image/png" });
      await testInfo.attach("short-desktop-geometry", {
        body: JSON.stringify({ viewport, stageBox, personalBox, interactionBox, headerOverlaps }, null, 2),
        contentType: "application/json",
      });

      expect.soft(personalBox.y, "The role card must remain below the table on a short desktop").toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
      for (const box of [stageBox, personalBox]) {
        expect.soft(box.x + box.width, "The table and role must not overlap the interaction panel").toBeLessThanOrEqual(interactionBox.x + 1);
      }
      for (const box of [stageBox, personalBox, interactionBox]) {
        expect.soft(box.x).toBeGreaterThanOrEqual(0);
        expect.soft(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      expect.soft(interactionBox.y + interactionBox.height, "The right panel must fit the short desktop viewport").toBeLessThanOrEqual(viewport.height);
      expect.soft(headerOverlaps, "The hide button must not cover role header text").toEqual([]);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.locator(".play-stage [data-private-dossier], .play-interaction-column [data-private-dossier]")).toHaveCount(0);
    });
  }
}

test("mobile conversation keeps phase context and returns directly to the table", async ({ page }) => {
  await openRoom(page, "phase=day_discussion&family=werewolves&players=8&timer=90");
  await page.getByRole("button", { name: "Към разговора" }).click();
  const input = page.getByRole("textbox", { name: "Съобщение в дневния разговор" });
  await expect(input).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("timer")).toBeVisible();
  await input.fill("Да чуем Рада.");
  await page.getByRole("button", { name: "Към масата" }).click();
  await expect(page.locator(".play-stage")).toBeVisible();
  await page.getByRole("button", { name: "Към разговора" }).click();
  await expect(input).toHaveValue("Да чуем Рада.");
});

for (const family of ["werewolves", "mafia"] as const) {
  for (const mobile of [false, true]) {
    const role = family === "mafia" ? "mafioso" : "werewolf";
    const viewport = mobile ? "mobile" : "desktop";
    test(`private draft survives inline concealment and conversation switches ${family} ${viewport}`, async ({ page }) => {
      await openRoom(page, `phase=night&family=${family}&players=8&role=${role}&timer=90`, mobile);
      const personal = page.locator(".play-primary-column > .play-personal-area");
      const card = personal.locator(".role-card[data-private-dossier]");
      const conversation = personal.locator("details").filter({ has: page.locator("summary", { hasText: "Личен разговор" }) });
      const summary = conversation.locator(":scope > summary");
      const input = personal.getByRole("textbox", { name: "Съобщение за таен канал" });
      const draft = "Нека проверим Рада първо.";
      await expect(card).toBeVisible();
      await expect(conversation).not.toHaveAttribute("open");
      await expect(input).not.toBeVisible();
      await summary.click();
      await expect(conversation).toHaveAttribute("open", "");
      await input.fill(draft);
      await summary.click();
      await expect(input).not.toBeVisible();
      await summary.click();
      await expect(input).toHaveValue(draft);

      await personal.getByRole("button", { name: "Скрий ролята", exact: true }).click();
      await expect(personal).toBeVisible();
      await expect(personal).toHaveAttribute("data-concealed", "true");
      await expect(page.locator("[data-private-dossier], .play-private-conversation, .role-card-result")).toHaveCount(0);
      await expect(page.getByRole("textbox", { name: "Съобщение за таен канал", includeHidden: true })).toHaveCount(0);
      await expect(personal.locator("#play-personal-content")).toBeEmpty();
      await personal.getByRole("button", { name: "Виж ролята си", exact: true }).click();
      await expect(card).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(page.getByRole("dialog")).toHaveCount(0);

      if (mobile) {
        await page.getByRole("button", { name: "Към разговора", exact: true }).click();
        await expect(personal).not.toBeVisible();
        await page.getByRole("tab", { name: "Събития", exact: true }).click();
        await page.getByRole("tab", { name: "Разговор", exact: true }).click();
        await page.getByRole("button", { name: "Към масата", exact: true }).click();
        await expect(card).toBeVisible();
        await expect(input).toBeVisible();
        await expect(input).toHaveValue(draft);
      }
      await expect(page.locator(".play-stage [data-private-dossier], .play-interaction-column [data-private-dossier]")).toHaveCount(0);
      for (const selector of [".play-stage", ".play-side-rail"]) {
        await expect(page.locator(selector)).not.toContainText(draft);
      }
      await expect(page.getByRole("button", { name: "Отвори тайното досие" })).toHaveCount(0);
    });

    test(`role reveal starts concealed and restores the role inline ${family} ${viewport}`, async ({ page }) => {
      await openRoom(page, `phase=role_reveal&family=${family}&players=8&role=${role}`, mobile);
      const personal = page.locator(".play-primary-column > .play-personal-area");
      await expect(personal).toHaveAttribute("data-concealed", "true");
      await expect(page.locator("[data-private-dossier], .play-private-conversation")).toHaveCount(0);
      await expect(personal.locator("#play-personal-content")).toBeEmpty();
      await expect(page.locator(".play-action-dock")).toHaveCount(0);
      await personal.getByRole("button", { name: "Виж ролята си", exact: true }).click();
      await expect(personal.locator(".role-card[data-private-dossier]")).toBeVisible();
      await expect(personal.getByRole("button", { name: "Скрий ролята", exact: true })).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator(".play-stage [data-private-dossier]")).toHaveCount(0);
      await personal.getByRole("button", { name: "Скрий ролята", exact: true }).click();
      await expect(page.locator("[data-private-dossier], .play-private-conversation")).toHaveCount(0);
    });
  }
}

test("compact phone keeps target selection above the expanded command", async ({ page }, testInfo) => {
  await openRoom(page, "phase=night&family=werewolves&players=12&role=seer&timer=8", true, "light");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Покажи личния ход" }).click();
  const dock = await page.locator(".play-action-dock").boundingBox();
  const target = page.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first();
  const bounds = await target.boundingBox();
  await testInfo.attach("compact-command-geometry", {
    body: JSON.stringify({ dock, target: bounds }, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ path: testInfo.outputPath("compact-command.png") });
  expect(dock).not.toBeNull();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThan(dock!.y);
  await target.click();
  await expect(page.getByRole("button", { name: "Провери заплахата" })).toBeEnabled();
});

for (const mobile of [false, true]) {
  test(`lobby host controls remain reachable in the command dock ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
    await openRoom(page, "phase=lobby&family=werewolves&viewer=host&players=12", mobile);
    await expect(page.locator(".play-narrator-deck")).toHaveCount(0);
    const dock = page.locator('.play-action-dock[data-dock-kind="lobby"]');
    await expect(dock).toBeVisible();
    const ready = dock.getByTestId("ready-toggle");
    const start = dock.getByRole("button", { name: "Започни игра", exact: true });
    const invite = dock.getByRole("button", { name: "Копирай покана", exact: true });
    await expect(ready).toBeVisible();
    await expect(start).toBeVisible();
    if (mobile) {
      await expect(dock).toHaveAttribute("data-expanded", "false");
      await expect(ready).toBeInViewport({ ratio: 1 });
      await expect(start).toBeInViewport({ ratio: 1 });
      await expect(invite).not.toBeVisible();
      await dock.getByRole("button", { name: "Покажи подробностите за стаята", exact: true }).click();
      await expect(dock).toHaveAttribute("data-expanded", "true");
    }
    const bounds = await dock.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    if (!mobile) expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight + 1);
    await expect(invite).toBeVisible();
    await invite.scrollIntoViewIfNeeded();
    await expect(invite).toBeInViewport({ ratio: 1 });
    if (mobile) {
      await dock.getByRole("button", { name: "Скрий подробностите за стаята", exact: true }).click();
      await expect(invite).not.toBeVisible();
      await expect(ready).toBeInViewport({ ratio: 1 });
      await expect(start).toBeInViewport({ ratio: 1 });
    }
  });
}

test("quiet desktop keeps the role inline without a role-only action dock", async ({ page }) => {
  await openRoom(page, "phase=day_discussion&family=werewolves&players=12", false, "light");
  await expect(page.locator(".play-personal-area .role-card[data-private-dossier]")).toBeVisible();
  await expect(page.locator(".play-action-dock")).toHaveCount(0);
  await page.getByRole("tab", { name: "Разговор", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Съобщение в дневния разговор" })).toBeInViewport({ ratio: 1 });
});
