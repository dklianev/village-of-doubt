import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readlinkSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { repairWindowsStandaloneSymlinks } from "./repair-standalone-symlinks.mjs";

test(
  "repairs Windows file symlinks that point to standalone package directories",
  { skip: process.platform !== "win32" },
  () => {
    const fixture = mkdtempSync(join(tmpdir(), "werewolf-standalone-links-"));
    try {
      const target = join(fixture, "store", "react");
      const dependencyDirectory = join(fixture, "consumer", "node_modules");
      const dependencyLink = join(dependencyDirectory, "react");
      mkdirSync(target, { recursive: true });
      mkdirSync(dependencyDirectory, { recursive: true });
      symlinkSync("..\\..\\store\\react", dependencyLink, "file");

      assert.throws(() => statSync(dependencyLink), { code: "EPERM" });
      assert.equal(repairWindowsStandaloneSymlinks(fixture), 1);
      assert.equal(statSync(dependencyLink).isDirectory(), true);
      assert.equal(readlinkSync(dependencyLink), "..\\..\\store\\react");
      assert.equal(repairWindowsStandaloneSymlinks(fixture), 0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);

test(
  "removes stale Windows symlinks whose standalone package target no longer exists",
  { skip: process.platform !== "win32" },
  () => {
    const fixture = mkdtempSync(join(tmpdir(), "werewolf-standalone-stale-links-"));
    try {
      const dependencyDirectory = join(fixture, "consumer", "node_modules");
      const dependencyLink = join(dependencyDirectory, "has-flag");
      mkdirSync(dependencyDirectory, { recursive: true });
      symlinkSync("..\\..\\store\\has-flag", dependencyLink, "file");

      assert.equal(repairWindowsStandaloneSymlinks(fixture), 1);
      assert.throws(() => statSync(dependencyLink), { code: "ENOENT" });
      assert.equal(repairWindowsStandaloneSymlinks(fixture), 0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  },
);
