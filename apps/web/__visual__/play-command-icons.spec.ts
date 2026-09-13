import { expect, test } from "playwright/test";

const scenarios = [
  { role: "commissioner", family: "mafia", phase: "night", commands: ["Провери дали е от Мафията"] },
  { role: "seer", family: "werewolves", phase: "night", commands: ["Провери заплахата"] },
  { role: "witch", family: "werewolves", phase: "night", commands: ["Лекувай", "Отрови"] },
  { role: "hunter", family: "werewolves", phase: "hunter_revenge", commands: ["Потвърди изстрела"] },
] as const;

for (const scenario of scenarios) {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [390, 1440] as const) {
      test(`play command icons ${scenario.role} ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width < 1024 ? 844 : 1000 });
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("werewolf-theme", selectedTheme);
        }, theme);
        await page.route("**/icon-ability-*.webp", (route) => route.abort());
        const query = new URLSearchParams({
          visualGame: "1", players: "9", role: scenario.role,
          family: scenario.family, phase: scenario.phase,
        });
        if (scenario.role === "hunter") query.set("viewer", "dead");
        await page.goto(`/play/VISUAL?${query}`);
        await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true");
        const dock = page.locator(".play-action-dock");
        if (width < 1024 && await dock.getAttribute("data-expanded") !== "true") {
          await dock.getByRole("button", { name: "Покажи личния ход" }).click();
        }
        for (const label of scenario.commands) {
          const command = dock.getByRole("button", { name: label, exact: true });
          await expect(command).toBeVisible();
          await expect(command).toBeDisabled();
          const icon = command.locator("svg");
          await expect(icon).toHaveCount(1);
          await expect(icon).toHaveAttribute("aria-hidden", "true");
          const drawing = await icon.evaluate((svg) => {
            const bounds = (svg as SVGSVGElement).getBBox();
            return { width: bounds.width, height: bounds.height, stroke: getComputedStyle(svg).stroke };
          });
          expect(drawing.width).toBeGreaterThan(8);
          expect(drawing.height).toBeGreaterThan(8);
          expect(drawing.stroke).not.toBe("none");
          expect(await command.evaluate((button) => getComputedStyle(button, "::after").content)).toBe("none");
          const padding = await command.evaluate((button) => {
            const style = getComputedStyle(button);
            return { left: style.paddingLeft, right: style.paddingRight };
          });
          expect(padding.left).toBe(padding.right);
        }
        await page.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first().click();
        const commands = dock.locator(".action-btn");
        await expect(commands.first()).toBeEnabled();
        for (const command of await commands.all()) {
          const buttonBox = (await command.boundingBox())!;
          const iconBox = (await command.locator("svg").boundingBox())!;
          expect(iconBox.width).toBeGreaterThanOrEqual(16);
          expect(iconBox.x).toBeGreaterThanOrEqual(buttonBox.x);
          expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(buttonBox.x + buttonBox.width);
        }
        const screenshot = testInfo.outputPath("command-icons.png");
        await page.screenshot({ path: screenshot, fullPage: width >= 1024 });
        await testInfo.attach("command-icons", { path: screenshot, contentType: "image/png" });
      });
    }
  }
}
