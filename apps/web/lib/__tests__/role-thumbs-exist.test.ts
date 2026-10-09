import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { roleThumbPath } from "@/lib/role-art";

// RoleCard's console and mini presentations load thumbs instead of the full plates,
// so every role must ship a thumb for every family it can appear in.
describe("role thumbs", () => {
  const cases = Object.entries(ROLE_DEFINITIONS).flatMap(([role, definition]) =>
    (definition.availableInFamilies as readonly GameFamily[]).map((family) => [family, role as RoleCode] as const),
  );

  it.each(cases)("ships a thumb for %s/%s", (family, role) => {
    const publicPath = roleThumbPath(family, role).split("?")[0];
    expect(existsSync(resolve(process.cwd(), "public", `.${publicPath}`))).toBe(true);
  });
});
