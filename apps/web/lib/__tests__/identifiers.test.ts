import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/identifiers";

describe("isUuid", () => {
  it("accepts canonical UUIDs and rejects malformed database identifiers", () => {
    expect(isUuid("7b877d37-0000-5000-8000-123456789abc")).toBe(true);
    expect(isUuid("not-a-game-id")).toBe(false);
    expect(isUuid("7b877d37-0000-5000-8000-123456789abc' OR 1=1")).toBe(false);
  });
});
