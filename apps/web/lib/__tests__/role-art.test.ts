import { describe, expect, it } from "vitest";
import { roleArtPath, roleThumbPath } from "@/lib/role-art";

describe("role art helpers", () => {
  it("uses the role's visual family when fixture params mix family and role", () => {
    expect(roleThumbPath("werewolves", "doctor")).toBe("/game-art/thumbs/mafia/role-doctor.webp");
    expect(roleArtPath("werewolves", "doctor", "png")).toBe("/game-art/mafia/role-doctor.png");
  });

  it("keeps native family assets unchanged", () => {
    expect(roleThumbPath("werewolves", "healer")).toBe("/game-art/thumbs/role-healer.webp");
    expect(roleThumbPath("mafia", "doctor")).toBe("/game-art/thumbs/mafia/role-doctor.webp");
  });

  it("uses distinct Jester artwork for Werewolf and Mafia", () => {
    expect(roleThumbPath("werewolves", "jester")).toBe("/game-art/thumbs/role-jester-werewolf.webp");
    expect(roleArtPath("werewolves", "jester")).toBe("/game-art/role-jester-werewolf.webp");
    expect(roleThumbPath("mafia", "jester")).toBe("/game-art/thumbs/mafia/role-jester.webp");
    expect(roleArtPath("mafia", "jester")).toBe("/game-art/mafia/role-jester.webp");
  });
});
