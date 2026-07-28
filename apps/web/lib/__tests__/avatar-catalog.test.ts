import { AVATAR_IDS } from "@werewolf/shared";
import { describe, expect, it } from "vitest";
import { AVATAR_OPTIONS, avatarPortraitStyle } from "@/lib/avatar-catalog";

describe("avatar catalog", () => {
  it("има отделен центриран asset за всеки подбран образ", () => {
    expect(AVATAR_OPTIONS.map((option) => option.id)).toEqual(AVATAR_IDS);

    for (const option of AVATAR_OPTIONS) {
      const style = avatarPortraitStyle(option.id);

      expect(style["--avatar-image"]).toContain(`/game-art/avatars/${option.id}.webp`);
      expect(style["--avatar-image"]).toBe(`url('/game-art/avatars/${option.id}.webp')`);
      expect(style["--avatar-image"]).not.toContain("sheet");
      expect(style).not.toHaveProperty("--avatar-x");
      expect(style).not.toHaveProperty("--avatar-y");
    }
  });
});
