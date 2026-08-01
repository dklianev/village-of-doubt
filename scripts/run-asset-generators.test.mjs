import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_ASSET_IMAGE,
  createAssetGeneratorInvocation,
} from "./run-asset-generators.mjs";

const generators = [
  "scripts/optimize-assets.mjs",
  "scripts/generate-critical-mobile-assets.mjs",
];

test("runs asset generators directly on the canonical Linux runtime", () => {
  const invocation = createAssetGeneratorInvocation({
    platform: "linux",
    rootDirectory: "/workspace",
    nodeExecutable: "/usr/bin/node",
    sharpVersion: "0.35.3",
    generators,
  });

  assert.deepEqual(invocation, {
    kind: "direct",
    commands: generators.map((script) => ({
      executable: "/usr/bin/node",
      args: [script],
    })),
  });
});

test("uses the pinned Linux encoder outside Linux", () => {
  const invocation = createAssetGeneratorInvocation({
    platform: "win32",
    rootDirectory: "E:\\werewolf_mafia",
    nodeExecutable: "node.exe",
    sharpVersion: "0.35.3",
    generators,
  });

  assert.equal(invocation.kind, "docker");
  assert.equal(invocation.executable, "docker");
  assert.ok(invocation.args.includes(CANONICAL_ASSET_IMAGE));
  assert.ok(invocation.args.includes("type=bind,source=E:\\werewolf_mafia,target=/repo"));
  assert.match(invocation.args.at(-1), /sharp@0\.35\.3/);
  assert.match(invocation.args.at(-1), /optimize-assets\.mjs/);
  assert.match(invocation.args.at(-1), /generate-critical-mobile-assets\.mjs/);
  assert.doesNotMatch(invocation.args.at(-1), /pnpm install/);
});

test("rejects generator paths that could escape the repository", () => {
  assert.throws(
    () =>
      createAssetGeneratorInvocation({
        platform: "win32",
        rootDirectory: "E:\\werewolf_mafia",
        nodeExecutable: "node.exe",
        sharpVersion: "0.35.3",
        generators: ["../outside.mjs"],
      }),
    /Invalid asset generator path/,
  );
});
