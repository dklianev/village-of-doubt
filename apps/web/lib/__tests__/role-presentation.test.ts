import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, getRoleRuntimeStatus, getRolesForFamily, teamLabelBg } from "@werewolf/shared";
import { getRoleCatalog, getRolePresentation } from "../role-presentation.server";
import { roleArtSource } from "../role-art";

describe("public role presentation boundary", () => {
  it.each(["werewolves", "mafia"] as const)("sends only the canonical %s catalogue with unchanged display data", (family) => {
    const catalog = getRoleCatalog(family);
    expect(catalog.map((role) => role.id)).toEqual(getRolesForFamily(family));
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);

    for (const role of catalog) {
      const canonical = ROLE_DEFINITIONS[role.id];
      for (const field of [
        "nameBg", "shortDescriptionBg", "fullDescriptionBg", "team", "value", "nightOrder",
        "isDefaultEnabled", "minPlayers", "maxCopies", "dependencies", "tags", "nightAction", "availableInFamilies",
      ] as const) {
        expect(role[field], `${role.id}.${field}`).toEqual(canonical[field]);
      }
      expect(role.runtimeStatus).toBe(getRoleRuntimeStatus(role.id));
      expect(role.teamLabel).toBe(teamLabelBg(canonical.team, family));
      expect(role.art).toEqual(roleArtSource(family, role.id));
      expect(role).not.toHaveProperty("secret");
      expect(role).not.toHaveProperty("gameId");
      expect(role).not.toHaveProperty("assetKey");
    }
    expect(catalog.some((role) => role.id === (family === "mafia" ? "seer" : "commissioner"))).toBe(false);
  });

  it("retains the shared Jester in both catalogues with each family's artwork", () => {
    const village = getRolePresentation("werewolves", "jester");
    const city = getRolePresentation("mafia", "jester");
    expect(village.fullDescriptionBg).toBe(city.fullDescriptionBg);
    expect(village.art.src).toBe("/game-art/role-jester-werewolf.webp?v=3");
    expect(city.art.src).toBe("/game-art/mafia/role-jester.webp");
    for (const family of ["werewolves", "mafia"] as const) {
      expect(getRoleCatalog(family).filter((role) => role.id === "jester")).toHaveLength(1);
    }
  });

  it("does not disguise a foreign-family role as a valid dossier", () => {
    expect(getRolePresentation("mafia", "seer").availableInFamilies).not.toContain("mafia");
  });
});
