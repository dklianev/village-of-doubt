import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("design-system focus ring", () => {
  it("keeps a real outline for forced-colors mode beside the decorative ring", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const rule = /\)\s*\*:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

    expect(rule).toContain("box-shadow: var(--ds-focus-ring)");
    // Forced colors drop box-shadow; a transparent outline is repainted with the system colour.
    expect(rule).toMatch(/outline:\s*2px solid transparent/);
    expect(rule).not.toMatch(/outline:\s*none/);
  });
});
