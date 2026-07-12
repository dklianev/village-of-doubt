import { describe, expect, it } from "vitest";
import { portraitSlot } from "@/lib/play/portrait-slot";

describe("portraitSlot", () => {
  it("is stable and stays inside the sprite sheet", () => {
    const ids = Array.from({ length: 18 }, (_, index) => `visual-player-${index + 1}`);
    const first = ids.map((id) => portraitSlot(id));
    const reordered = [...ids].reverse().map((id) => [id, portraitSlot(id)] as const);

    expect(first.every((slot) => slot >= 0 && slot < 9)).toBe(true);
    for (const [id, slot] of reordered) {
      expect(slot).toBe(portraitSlot(id));
    }
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it("rejects invalid sheet sizes", () => {
    expect(() => portraitSlot("u1", 0)).toThrow(RangeError);
  });
});
