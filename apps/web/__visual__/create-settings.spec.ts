import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";
import sharp from "sharp";

function luminance(rgb: number[]) {
  const linear = rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

for (const theme of ["light", "dark"] as const) {
  for (const family of ["werewolf", "mafia"] as const) {
    for (const width of [320, 1440]) {
      test(`create settings ${family} ${theme} ${width}: contrast and truthful customization`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 320 ? 740 : 1000 });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        const path = `/${family}/create?visualAuth=1`;
        for (const ready of [true, false]) {
          const roles = family === "mafia" ? "civilian:10" : "ordinary_villager:12";
          await page.goto(ready ? path : `${path}&roles=${roles}`);
          await expect(page.locator(".create-ready-mark")).toHaveAttribute("data-ready", String(ready));
          const contrast = await new AxeBuilder({ page }).include(".create-ready-mark").withRules(["color-contrast"]).analyze();
          expect(contrast.violations).toEqual([]);
          // Axe cannot resolve the page's art pseudo-element, so sample the rendered status background.
          const mark = page.locator(".create-ready-mark");
          const foreground = await mark.evaluate((element) => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            context.fillStyle = getComputedStyle(element).color;
            context.fillRect(0, 0, 1, 1);
            return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
          });
          const { data, info } = await sharp(await mark.screenshot({ caret: "initial" })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const ratios = [[6, Math.floor(info.height / 2)], [info.width - 6, Math.floor(info.height / 2)], [Math.floor(info.width / 2), 3]].map(([x, y]) => {
            const offset = (y! * info.width + x!) * info.channels;
            const bg = luminance(Array.from(data.subarray(offset, offset + 3)));
            const fg = luminance(foreground);
            return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
          });
          expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
          await test.info().attach(`contrast-${ready}`, { body: JSON.stringify({ foreground, ratios }), contentType: "application/json" });
        }

        await page.goto(path);
        await expect(page).toHaveURL(new RegExp(`/${family}/create`));
        await expect(page).toHaveTitle(/Върколак|Мафия/);
        if (family === "mafia") {
          await page.getByRole("button", { name: /Спортна маса/ }).click();
        }
        const trigger = page.getByRole("button", { name: "Настрой детайлите", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
        await expect(dialog.getByText(/текущата подготовка/)).toBeVisible();
        await dialog.getByRole("tab", { name: "Име на стаята" }).click();
        await dialog.getByRole("textbox", { name: "Име на стаята" }).fill("Нашата вечер");
        await dialog.getByRole("button", { name: "Готово", exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(dialog.getByRole("textbox", { name: "Име на стаята" })).toHaveValue("Нашата вечер");

        if (family === "mafia") {
          await dialog.getByRole("tab", { name: "Правила и комуникация" }).click();
          await dialog.getByText("Покажи още настройки").click();
          await expect(dialog.getByRole("checkbox", { name: /Добави Маниак|Добави Шут/ })).toHaveCount(0);
          await expect(dialog.getByText(/6 граждани, 2 мафиоти, Дон и Комисар/)).toBeVisible();
          await dialog.getByRole("button", { name: "Премини към свободна Мафия" }).click();
          await dialog.getByRole("checkbox", { name: /Добави Маниак/ }).check();
          await dialog.getByRole("checkbox", { name: /Добави Шут/ }).check();
          await expect(dialog.getByRole("checkbox", { name: /Добави Маниак/ })).toBeChecked();
          await expect(dialog.getByRole("checkbox", { name: /Добави Шут/ })).toBeChecked();
        }

        await dialog.getByRole("tab", { name: "Ритъм и водене" }).click();
        const styles = dialog.getByRole("radiogroup", { name: "Стил на Разказвача" });
        await styles.getByRole("radio", { name: /Инспекторът/ }).check();
        await expect(dialog.getByText(family === "mafia"
          ? "Всички алибита ще бъдат проверени сутринта."
          : "Движението в селото се наблюдава.")).toBeVisible();
        await page.keyboard.press("ArrowRight");
        await expect(styles.getByRole("radio", { name: /Вещицата/ })).toBeChecked();
        await expect(dialog.getByText("Проба", { exact: true })).toHaveCount(0);
        await dialog.locator(".narrator-style-example").scrollIntoViewIfNeeded();
        await expect(dialog.getByRole("button", { name: "Готово", exact: true })).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const clipped = await styles.evaluate((group) => Array.from(group.querySelectorAll("label")).some((label) => label.scrollWidth > label.clientWidth));
        expect(clipped).toBe(false);
        await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
        await page.screenshot({ path: test.info().outputPath(`${family}-${theme}-${width}.png`), caret: "initial" });
        expect(errors).toEqual([]);
      });
    }
  }
}
