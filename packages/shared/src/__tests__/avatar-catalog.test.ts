import { describe, expect, it } from "vitest";
import {
  AVATAR_IDS,
  DEFAULT_AVATAR_ID,
  avatarIdForSeed,
  isAvatarId,
  normalizeAvatarId,
} from "../avatar-catalog.js";

describe("avatar catalog", () => {
  it("accepts only curated portrait identifiers", () => {
    expect(AVATAR_IDS).toHaveLength(14);
    expect(isAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
    expect(isAvatarId("portrait-m01")).toBe(true);
    expect(isAvatarId("https://example.com/avatar.png")).toBe(false);
    expect(isAvatarId("portrait-m99")).toBe(false);
  });

  it("normalizes unknown values to the safe default", () => {
    expect(normalizeAvatarId("portrait-f04")).toBe("portrait-f04");
    expect(normalizeAvatarId(undefined)).toBe(DEFAULT_AVATAR_ID);
    expect(normalizeAvatarId("../../avatar.png")).toBe(DEFAULT_AVATAR_ID);
  });

  it("selects a stable curated fallback from a user seed", () => {
    expect(avatarIdForSeed("user-42")).toBe(avatarIdForSeed("user-42"));
    expect(isAvatarId(avatarIdForSeed("user-42"))).toBe(true);
  });
});
