import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const extractZipPatch = readFileSync(new URL("../patches/extract-zip@2.0.1.patch", import.meta.url), "utf8");

test("extract-zip symlinks cannot escape the extraction root", () => {
  assert.match(workspace, /extract-zip@2\.0\.1: patches\/extract-zip@2\.0\.1\.patch/);
  assert.match(workspace, /auditConfig:\s+[\s\S]*ignoreGhsas:/);
  assert.match(workspace, /GHSA-jmr9-qjv8-65gv/);
  assert.match(extractZipPatch, /path\.isAbsolute\(linkTarget\)/);
  assert.match(extractZipPatch, /path\.isAbsolute\(relativeTarget\)/);
  assert.match(extractZipPatch, /relativeTarget\.startsWith\(`\.\.\$\{path\.sep\}`\)/);
  assert.match(extractZipPatch, /await fs\.symlink\(linkTarget, dest\)/);
});
