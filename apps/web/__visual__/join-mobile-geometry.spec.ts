import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test("all six room-code slots stay on one row at 375px", async ({ page }) => {
  const stylesheet = readFileSync(resolve(process.cwd(), "apps/web/components/games/JoinEntry.module.css"), "utf8");
  const groupDeclarations = declarationsFor(stylesheet, ".join-codeslots");
  const slotDeclarations = declarationsFor(stylesheet, ".join-codeslot");
  const contentWidth = 375 - 20 - 48;

  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      .join-codeslots { ${groupDeclarations} }
      .join-codeslot { ${slotDeclarations} }
    </style>
    <main style="width: ${contentWidth}px">
      <div class="join-codeslots" role="group" aria-label="Код на стаята">
        ${Array.from({ length: 6 }, (_, index) => `<input class="join-codeslot" aria-label="Символ ${index + 1} от 6">`).join("")}
      </div>
    </main>
  `);

  const group = page.getByRole("group", { name: "Код на стаята" });
  const slots = group.getByRole("textbox");
  await expect(slots).toHaveCount(6);

  const geometry = await slots.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top };
    }),
  );
  const groupBox = await group.boundingBox();

  expect(groupBox).not.toBeNull();
  expect(Math.max(...geometry.map(({ top }) => top)) - Math.min(...geometry.map(({ top }) => top))).toBeLessThan(1);
  expect(geometry[0]!.left).toBeGreaterThanOrEqual(groupBox!.x - 0.5);
  expect(geometry.at(-1)!.right).toBeLessThanOrEqual(groupBox!.x + groupBox!.width + 0.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

function declarationsFor(stylesheet: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declarations = stylesheet.match(new RegExp(`:global\\(${escapedSelector}\\)\\s*\\{([^}]*)\\}`, "s"))?.[1];
  if (!declarations) {
    throw new Error(`Missing ${selector} declarations.`);
  }
  return declarations;
}
