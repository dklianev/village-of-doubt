import { expect, test } from "playwright/test";

for (const [family, role, width, theme] of [
  ["werewolves", "werewolf", 390, "dark"],
  ["mafia", "mafioso", 1440, "light"],
] as const) {
  test(`private chat visibility and overflow reading ${family} ${width}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("werewolf-theme", selectedTheme);
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    }, theme);
    await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=night&players=8&role=${role}`);
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    const conversation = page.locator(".play-private-conversation");
    const log = conversation.getByRole("log");
    const unread = conversation.locator(".play-private-unread");
    await expect(unread).toHaveText("1 ново");
    await conversation.locator("summary").click();
    await expect(log).toBeVisible();
    await expect(unread).toHaveText("1 ново");

    // The existing fixture has one message; give it enough height to exercise native overflow.
    const overflowStyle = await page.addStyleTag({ content: '.play-private-conversation [role="log"] > p { min-height: 600px; }' });
    await expect.poll(() => log.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await log.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => log.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(1);
    await expect(unread).toHaveCount(0);
    await log.evaluate((element) => { element.scrollTop = 80; element.dispatchEvent(new Event("scroll")); });
    const input = conversation.getByRole("textbox");
    await input.fill("Запазен личен текст");

    await conversation.locator("summary").click();
    await conversation.locator("summary").click();
    await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(80);
    await expect(input).toHaveValue("Запазен личен текст");
    await page.getByRole("button", { name: "Скрий ролята", exact: true }).click();
    await page.getByRole("button", { name: "Виж ролята си", exact: true }).click();
    await expect(log).toBeVisible();
    await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(80);
    await expect(input).toHaveValue("Запазен личен текст");

    if (width < 1024) {
      await page.getByRole("button", { name: "Към разговора", exact: true }).click();
      await page.getByRole("button", { name: "Към масата", exact: true }).click();
      await expect.poll(() => log.evaluate((element) => element.scrollTop)).toBe(80);
    }
    await log.focus();
    await log.press("End");
    await expect.poll(() => log.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(1);
    await expect(log).toHaveCSS("max-height", "240px");
    await overflowStyle.evaluate((element) => element.parentNode?.removeChild(element));
    await expect(log).toContainText("Избираме внимателно");
    await page.screenshot({ path: testInfo.outputPath("private-chat-reading.png") });
    expect(errors).toEqual([]);
  });
}
