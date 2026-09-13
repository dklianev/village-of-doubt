import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { getRolesForFamily } from "@werewolf/shared";
import { coverImageSizes, roleArtPath, roleArtSource, roleThumbPath } from "@/lib/role-art";

describe("role art helpers", () => {
  it("uses the role's visual family when fixture params mix family and role", () => {
    expect(roleThumbPath("werewolves", "doctor")).toBe("/game-art/thumbs/mafia/role-doctor.webp?v=2");
    expect(roleArtPath("werewolves", "doctor", "png")).toBe("/game-art/mafia/role-doctor.png");
  });

  it("keeps native family assets unchanged", () => {
    expect(roleThumbPath("werewolves", "healer")).toBe("/game-art/thumbs/role-healer.webp?v=3");
    expect(roleThumbPath("mafia", "doctor")).toBe("/game-art/thumbs/mafia/role-doctor.webp?v=2");
  });

  it("uses distinct Jester artwork for Werewolf and Mafia", () => {
    expect(roleThumbPath("werewolves", "jester")).toBe("/game-art/thumbs/role-jester-werewolf.webp?v=3");
    expect(roleArtPath("werewolves", "jester")).toBe("/game-art/role-jester-werewolf.webp?v=3");
    expect(roleThumbPath("mafia", "jester")).toBe("/game-art/thumbs/mafia/role-jester.webp");
    expect(roleArtPath("mafia", "jester")).toBe("/game-art/mafia/role-jester.webp");
  });

  for (const family of ["werewolves", "mafia"] as const) {
    it.each(getRolesForFamily(family))(`keeps ${family} %s dimensions aligned with the published artwork`, async (role) => {
      const source = roleArtSource(family, role);
      const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../public", `.${new URL(source.src, "https://assets.test").pathname}`);
      const metadata = await sharp(file).metadata();
      expect({ width: source.width, height: source.height }).toEqual({ width: metadata.width, height: metadata.height });
    });
  }

  it("keeps dimensions aligned with the resolved visual family", () => {
    expect(roleArtSource("werewolves", "doctor")).toEqual({
      src: "/game-art/mafia/role-doctor.webp?v=2", width: 1100, height: 1100,
    });
    expect(roleArtSource("mafia", "healer")).toEqual({
      src: "/game-art/role-healer.webp?v=3", width: 1024, height: 1536,
    });
    expect(roleArtSource("werewolves", "jester")).toEqual({
      src: "/game-art/role-jester-werewolf.webp?v=3", width: 1024, height: 1536,
    });
  });

  it.each([
    ["werewolves", "insomniac"],
    ["mafia", "doctor"], ["mafia", "detective"], ["mafia", "maniac"], ["mafia", "lovers"],
  ] as const)("refreshes both cached %s %s art sizes without changing the source master path", (family, role) => {
    expect(new URL(roleArtPath(family, role), "https://assets.test").search).toBe("?v=2");
    expect(new URL(roleThumbPath(family, role), "https://assets.test").search).toBe("?v=2");
    expect(new URL(roleArtPath(family, role, "png"), "https://assets.test").search).toBe("");
  });

  it.each([
    ["werewolves", "ordinary_villager"], ["werewolves", "werewolf"], ["werewolves", "seer"],
    ["werewolves", "witch"], ["werewolves", "healer"], ["werewolves", "priest"],
    ["werewolves", "hunter"], ["werewolves", "cupid"], ["werewolves", "vampire"],
    ["werewolves", "little_girl"], ["werewolves", "thief"], ["werewolves", "jester"], ["werewolves", "mayor"],
    ["mafia", "civilian"], ["mafia", "mafioso"], ["mafia", "commissioner"], ["mafia", "don"],
  ] as const)("invalidates both cached sizes of the unframed %s %s portrait", (family, role) => {
    expect(new URL(roleArtPath(family, role), "https://assets.test").search).toBe("?v=3");
    expect(new URL(roleThumbPath(family, role), "https://assets.test").search).toBe("?v=3");
  });

  it.each([
    [{ width: 1100, height: 1100 }, "calc(112px * 1.5)"],
    [{ width: 1536, height: 1024 }, "calc(112px * 2.25)"],
    [{ width: 1536, height: 1152 }, "calc(112px * 2)"],
    [{ width: 1024, height: 1536 }, "112px"],
  ] as const)("accounts for source aspect ratio %j in a portrait cover slot", (source, expected) => {
    expect(coverImageSizes(source, [{ width: 112, aspectRatio: 2 / 3 }])).toBe(expected);
  });

  it("preserves typed media and nested width expressions without parsing comma-separated sizes", () => {
    expect(coverImageSizes({ width: 1100, height: 1100 }, [
      { media: "(max-width: 600px)", width: "min(206px, calc(72vw - 14px))", aspectRatio: 2 / 3 },
      { width: 342, aspectRatio: 2 / 3 },
    ])).toBe("(max-width: 600px) calc(min(206px, calc(72vw - 14px)) * 1.5), calc(342px * 1.5)");
  });

  it("does not undersize a portrait that fills a square crop by width", () => {
    expect(coverImageSizes({ width: 1024, height: 1536 }, [{ width: 200, aspectRatio: 1 }])).toBe("200px");
  });
});
