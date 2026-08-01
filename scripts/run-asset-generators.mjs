import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_ASSET_IMAGE =
  "node:22-bookworm@sha256:7725a5c2c83eed1d36258c66efae14b1ceccd021db9ed1d9559d3335ed3d68ed";

const BASE_GENERATORS = [
  "scripts/optimize-assets.mjs",
  "scripts/generate-critical-mobile-assets.mjs",
];
const PHASE_RAIL_GENERATOR = "scripts/generate-phase-rail-assets.mjs";

export function createAssetGeneratorInvocation({
  platform,
  rootDirectory,
  nodeExecutable,
  sharpVersion,
  generators,
}) {
  validateSharpVersion(sharpVersion);
  generators.forEach(validateGeneratorPath);

  if (platform === "linux") {
    return {
      kind: "direct",
      commands: generators.map((script) => ({
        executable: nodeExecutable,
        args: [script],
      })),
    };
  }

  const copiedGenerators = generators
    .map((script) => {
      const name = path.posix.basename(script);
      return `cp ${shellQuote(`/repo/${script}`)} ${shellQuote(`/asset-tool/${name}`)}`;
    })
    .join("; ");
  const executedGenerators = generators
    .map((script) => `node ${shellQuote(`/asset-tool/${path.posix.basename(script)}`)}`)
    .join("; ");

  return {
    kind: "docker",
    executable: "docker",
    args: [
      "run",
      "--rm",
      "--mount",
      `type=bind,source=${rootDirectory},target=/repo`,
      CANONICAL_ASSET_IMAGE,
      "bash",
      "-lc",
      [
        "set -euo pipefail",
        "mkdir -p /asset-tool",
        "cd /asset-tool",
        "npm init -y >/dev/null",
        `npm install --no-audit --no-fund --package-lock=false sharp@${sharpVersion} >/dev/null`,
        copiedGenerators,
        "cd /repo",
        executedGenerators,
      ].join("; "),
    ],
  };
}

export function runAssetGenerators({
  generators = BASE_GENERATORS,
  platform = process.platform,
  rootDirectory = process.cwd(),
  nodeExecutable = process.execPath,
  sharpVersion = readSharpVersion(rootDirectory),
} = {}) {
  const invocation = createAssetGeneratorInvocation({
    platform,
    rootDirectory,
    nodeExecutable,
    sharpVersion,
    generators,
  });

  const commands =
    invocation.kind === "direct"
      ? invocation.commands
      : [{ executable: invocation.executable, args: invocation.args }];

  for (const command of commands) {
    const result = spawnSync(command.executable, command.args, {
      cwd: rootDirectory,
      stdio: "inherit",
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const error = new Error(`Asset generator exited with status ${result.status ?? "unknown"}.`);
      error.exitCode = result.status ?? 1;
      throw error;
    }
  }
}

function readSharpVersion(rootDirectory) {
  const packageJson = JSON.parse(readFileSync(path.join(rootDirectory, "package.json"), "utf8"));
  const version = packageJson.devDependencies?.sharp;
  if (typeof version !== "string") {
    throw new Error("Root package.json must pin sharp as a devDependency.");
  }
  return version;
}

function validateSharpVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Asset tooling requires an exact sharp version, received: ${version}`);
  }
}

function validateGeneratorPath(generator) {
  if (!/^scripts\/[a-z0-9-]+\.mjs$/.test(generator)) {
    throw new Error(`Invalid asset generator path: ${generator}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const generators = args.has("--only-phase-rail")
    ? [PHASE_RAIL_GENERATOR]
    : args.has("--include-phase-rail")
      ? [...BASE_GENERATORS, PHASE_RAIL_GENERATOR]
      : BASE_GENERATORS;

  try {
    runAssetGenerators({ generators });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(error?.exitCode ?? 1);
  }
}
