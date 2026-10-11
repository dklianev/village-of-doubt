import { describe, expect, it } from "vitest";
import { publicGameReference } from "../game-reference";

describe("public case references", () => {
  it("produces the same numeric label across route spellings without using room codes", () => {
    const id = "b8d281c8-a264-4a3c-b89b-4d8d1c3e1f20";
    const reference = publicGameReference(id);
    expect(reference).toMatch(/^\d{8,10}$/);
    expect(publicGameReference(id.toUpperCase())).toBe(reference);
    expect(reference).not.toContain("b8d281c8");
    expect(publicGameReference("00000000-0000-4000-8000-000000000001"))
      .not.toBe(publicGameReference("00000000-0000-4000-8000-000000000002"));
  });
});
