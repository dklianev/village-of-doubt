import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("rules hero actions on phones", () => {
  it("stack in one column so the hero height does not depend on which font has loaded", () => {
    const css = readFileSync(resolve(process.cwd(), "components/games/GameRulesPage.module.css"), "utf8");
    const phone = /@media \(max-width: 480px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

    expect(phone).toMatch(/:global\(\.rules-hero-actions > \*\) \{[^}]*width: 100%/);
  });
});
