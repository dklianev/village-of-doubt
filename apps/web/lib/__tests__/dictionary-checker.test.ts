import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Bulgarian dictionary checker", () => {
  it("reports the canonical Разговор rule for standalone Cyrillic Чат text", () => {
    const repoRoot = resolve(process.cwd(), "../..");
    const fixtureDir = mkdtempSync(join(tmpdir(), "werewolf-dictionary-"));
    writeFileSync(
      join(fixtureDir, "copy.tsx"),
      "export const Copy = () => <><span>Чат</span><span>СуперЧатбот</span></>;\n",
      "utf8",
    );

    const result = spawnSync(process.execPath, ["scripts/check-dictionary.mjs", fixtureDir], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    rmSync(fixtureDir, { recursive: true, force: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\[warn\][^\n]*copy\.tsx[^\n]*"Чат"[^\n]*Разговор/);
    expect(result.stdout).toContain("Summary: 1 hard warnings");
  });

  it("проверява production copy и извън React страниците", () => {
    const repoRoot = resolve(process.cwd(), "../..");
    const checker = readFileSync(join(repoRoot, "scripts/check-dictionary.mjs"), "utf8");

    expect(checker).toContain('"apps/game-server/src"');
    expect(checker).toContain('"packages/shared/src"');
  });

  it("не намира забранения термин Чат в server/shared production copy", () => {
    const repoRoot = resolve(process.cwd(), "../..");
    const result = spawnSync(
      process.execPath,
      ["scripts/check-dictionary.mjs", "apps/game-server/src", "packages/shared/src"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Summary: 0 hard warnings");
  });
});
