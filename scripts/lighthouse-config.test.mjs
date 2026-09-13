import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

function loadConfig(overrides = {}) {
  const env = { ...process.env };
  for (const key of ["LIGHTHOUSE_PROFILE", "LIGHTHOUSE_SAVE_ASSETS", "LHCI_PORT", "LHCI_OUTPUT_DIR"]) {
    delete env[key];
  }
  const result = spawnSync(process.execPath, [
    "-e",
    "process.stdout.write(JSON.stringify(require('./lighthouserc.cjs')))",
  ], {
    cwd: root,
    env: { ...env, ...overrides },
    encoding: "utf8",
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("Lighthouse asset capture is off locally unless explicitly opted in", () => {
  const defaults = loadConfig();
  assert.deepEqual(defaults.ci.collect.settings, {});
  assert.deepEqual(loadConfig({ LIGHTHOUSE_PROFILE: "mobile" }), defaults);
  for (const value of ["", "0", "true"]) {
    assert.deepEqual(loadConfig({ LIGHTHOUSE_SAVE_ASSETS: value }), defaults);
  }
});

test("mobile opt-in changes only saveAssets, preserving measurement and assertion settings", () => {
  const expected = loadConfig({ LIGHTHOUSE_PROFILE: "mobile" });
  expected.ci.collect.settings.saveAssets = true;

  assert.deepEqual(loadConfig({
    LIGHTHOUSE_PROFILE: "mobile",
    LIGHTHOUSE_SAVE_ASSETS: "1",
  }), expected);
  assert.deepEqual(loadConfig({ LIGHTHOUSE_SAVE_ASSETS: "1" }), expected);
});

test("desktop ignores asset capture opt-in and preserves its complete configuration", () => {
  const defaults = loadConfig({ LIGHTHOUSE_PROFILE: "desktop" });
  assert.equal(defaults.ci.collect.settings.saveAssets, undefined);
  assert.deepEqual(loadConfig({
    LIGHTHOUSE_PROFILE: "desktop",
    LIGHTHOUSE_SAVE_ASSETS: "1",
  }), defaults);
});
