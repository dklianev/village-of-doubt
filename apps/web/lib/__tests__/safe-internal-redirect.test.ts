import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

describe("safeInternalRedirect", () => {
  it("preserves an internal path with query and hash", () => {
    expect(safeInternalRedirect("/play/ABC123?seat=2#table")).toBe("/play/ABC123?seat=2#table");
  });

  it.each([
    "https://attacker.invalid",
    "//attacker.invalid",
    "/\\attacker.invalid",
    "/%5Cattacker.invalid",
    "/%2Fattacker.invalid",
    "/path%0Aheader",
  ])("rejects unsafe redirect %s", (value) => {
    expect(safeInternalRedirect(value, "/fallback")).toBe("/fallback");
  });
});
