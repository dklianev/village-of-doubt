import { ROLE_DEFINITIONS, getRoleRuntimeStatus, getRolesForFamily, type GameFamily } from "@werewolf/shared";
import { expect, type Locator } from "playwright/test";

// Shared by the routed app test and the standalone real-component browser fixture.
export async function checkRoleEditorWorkflow(dialog: Locator, family: GameFamily, mobile: boolean) {
  const gallery = dialog.getByRole("region", { name: "Избор на роли" });
  const tiles = gallery.locator(".role-tile-large");
  const tile = tiles.first();
  await expect(tile).toBeVisible();
  if (mobile) {
    const box = await tile.boundingBox();
    const footer = await dialog.getByRole("button", { name: "Готово", exact: true }).boundingBox();
    await expect(tile).toHaveCSS("aspect-ratio", "auto");
    await expect(tile.locator("picture")).toHaveCSS("width", "64px");
    await expect(tile.locator("picture")).toHaveCSS("height", "88px");
    expect(box!.y + box!.height).toBeLessThan(footer!.y);
    for (const name of ["Запази шаблон", "Зареди шаблон"]) {
      const action = dialog.getByRole("button", { name, exact: true });
      await expect(action).toHaveCSS("width", "44px");
      await expect(action).toHaveCSS("height", "44px");
      const actionBox = await action.boundingBox();
      // Transformed DOMRects can report 43.9999847 for an exact 44px layout box.
      expect(actionBox!.width).toBeCloseTo(44, 3);
      expect(actionBox!.height).toBeCloseTo(44, 3);
      await expect(action.locator("svg")).toHaveCSS("width", "16px");
      await expect(action.locator("svg")).toHaveCSS("height", "16px");
      const icon = await action.locator("svg").boundingBox();
      expect(icon!.width).toBeCloseTo(16, 3);
      expect(icon!.height).toBeCloseTo(16, 3);
    }
    await dialog.getByRole("button", { name: "Покажи състава" }).click();
    const expanded = dialog.getByRole("button", { name: "Скрий състава" });
    await expect(expanded).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.locator(".create-selected-role-list")).toBeVisible();
    await expanded.click();
    await expect(dialog.getByRole("button", { name: "Покажи състава" })).toHaveAttribute("aria-expanded", "false");
    await expect(dialog.locator(".create-selected-role-list")).toBeHidden();
  }

  // Workspace filters stay expanded, independently of the hidden carousel controls.
  const search = dialog.getByRole("textbox", { name: "Търси роля" });
  const empty = gallery.getByText("Няма роли за този филтър.");
  const names = tiles.locator(".role-tile-caption strong");
  const expectedNames = (runtime: "playable" | "manual_only") => getRolesForFamily(family)
    .filter((role) => role !== "lovers" && getRoleRuntimeStatus(role) === runtime)
    .map((role) => ROLE_DEFINITIONS[role].nameBg);
  await expect(search).toBeVisible();
  await expect(search).toBeEditable();
  await expect(names).toHaveText(expectedNames("playable"));
  await search.fill("няма-такава-роля");
  await expect(empty).toBeVisible();
  await expect(tiles).toHaveCount(0);
  await search.fill(family === "werewolves" ? "seer" : "commissioner");
  await expect(names).toHaveText([ROLE_DEFINITIONS[family === "werewolves" ? "seer" : "commissioner"].nameBg]);
  await expect(empty).toBeHidden();
  await search.fill("");
  await expect(names).toHaveText(expectedNames("playable"));

  const manual = dialog.getByRole("button", { name: "Ръчно водени", exact: true });
  const automatic = dialog.getByRole("button", { name: "Автоматични", exact: true });
  await manual.click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await expect(automatic).toHaveAttribute("aria-pressed", "false");
  const manualNames = expectedNames("manual_only");
  await expect(names).toHaveText(manualNames);
  if (manualNames.length === 0) await expect(empty).toBeVisible();
  await automatic.click();
  await expect(automatic).toHaveAttribute("aria-pressed", "true");
  await expect(manual).toHaveAttribute("aria-pressed", "false");
  await expect(names).toHaveText(expectedNames("playable"));
  await expect(empty).toBeHidden();
  await expect(search).toBeVisible();

  await expect(dialog.getByRole("button", { name: "Предишни роли" })).toBeHidden();
  await expect(dialog.getByRole("button", { name: "Следващи роли" })).toBeHidden();
  const lastTile = tiles.last();
  await lastTile.scrollIntoViewIfNeeded();
  await expect(lastTile).toBeInViewport({ ratio: 1 });
  await expect(lastTile.locator(".role-tile-caption")).toBeInViewport({ ratio: 1 });
  expect(await gallery.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
}
