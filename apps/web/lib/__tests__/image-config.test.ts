import type { NextConfig } from "next";
import { describe, expect, it, vi } from "vitest";
import config from "../../next.config";
import { hasLocalMatch } from "next/dist/shared/lib/match-local-pattern";

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: (value: NextConfig) => value }));

describe("image optimizer limits", () => {
  it("allows only the explicit art revision query, without opening arbitrary optimizer queries", () => {
    const patterns = config.images?.localPatterns;
    expect(hasLocalMatch(patterns, "/game-art/role-werewolf.webp?v=2")).toBe(true);
    expect(hasLocalMatch(patterns, "/game-art/thumbs/mafia/role-lovers.webp?v=2")).toBe(true);
    expect(hasLocalMatch(patterns, "/logo.png")).toBe(true);
    expect(hasLocalMatch(patterns, "/game-art/role-werewolf.webp?v=3")).toBe(true);
    expect(hasLocalMatch(patterns, "/game-art/thumbs/mafia/role-commissioner.webp?v=3")).toBe(true);
    expect(hasLocalMatch(patterns, "/game-art/role-werewolf.webp?v=4")).toBe(false);
    expect(hasLocalMatch(patterns, "/game-art/role-werewolf.webp?v=3&extra=1")).toBe(false);
    expect(hasLocalMatch(patterns, "/api/account?v=3")).toBe(false);
    expect(hasLocalMatch(patterns, "/game-art/role-werewolf.webp?v=2&extra=1")).toBe(false);
    expect(hasLocalMatch(patterns, "/api/account?v=2")).toBe(false);
  });
  it("allows the existing default and the bounded high-density artwork quality", () => {
    expect(config.images?.qualities).toEqual([75, 85]);
    expect(config.images?.unoptimized).not.toBe(true);
  });

  it("offers a native homepage-size candidate without removing larger existing sizes", () => {
    expect(config.images?.deviceSizes).toEqual(expect.arrayContaining([640, 750, 828, 1080, 1200, 1536, 1920, 2048, 3840]));
  });

  it("avoids the 128-to-256 jump for compact DPR 2 role cards", () => {
    expect(config.images?.imageSizes).toEqual([32, 48, 64, 96, 128, 192, 256, 384]);
  });
});
