import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredGuidance = [
  "AGENTS.md",
  "apps/web/AGENTS.md",
  "apps/game-server/AGENTS.md",
  "packages/database/AGENTS.md",
  "packages/ui/AGENTS.md",
  "scripts/AGENTS.md",
  "agents-shared/README.md",
  "agents-shared/add-role.md",
  "agents-shared/role-mechanics-review.md",
  "agents-shared/bg-copy-review.md",
];
const ignoredDiscoveryDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  ".claude",
  ".codex",
  ".lighthouseci",
  ".release-state",
  "caddy_config",
  "caddy_data",
  "coverage",
  "dist",
  "node_modules",
  "output",
  "postgres_data",
  "storybook-static",
  "test-results",
  "tmp",
]);
const guidanceFiles = [
  ...discoverAgentGuides(root),
  ...(existsSync(path.join(root, "agents-shared"))
    ? readdirSync(path.join(root, "agents-shared"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => `agents-shared/${entry.name}`)
    : []),
].filter((entry, index, entries) => entries.indexOf(entry) === index).sort();
const rootGuidancePath = guidanceFiles.includes("AGENTS.override.md") ? "AGENTS.override.md" : "AGENTS.md";
const staleClaims = [
  {
    name: "calendar-dated dependency claim",
    pattern: /версии?\s+(?:са\s+)?актуалн\S*\s+за\s+Q[1-4]\s+\d{4}/giu,
  },
  {
    name: "hard-coded aggregate test count",
    pattern: /(?:всички\s+)?\d+\s+(?:tests?|теста|тестове|contract checks?)/giu,
  },
  {
    name: "historical PR as current guidance",
    pattern: /\bPR\s*#?\d+\s+версия(?:та)?(?!\p{L})/giu,
  },
  {
    name: "fragile source line anchor",
    pattern: /\b[\w./-]+\.(?:[cm]?[jt]sx?|md):\d+\b/giu,
  },
];
const pnpmBuiltins = new Set([
  "add",
  "audit",
  "dlx",
  "exec",
  "install",
  "remove",
  "run",
  "update",
]);
const errors = [];

for (const relativePath of requiredGuidance) {
  if (!existsSync(path.join(root, relativePath))) {
    errors.push(`${relativePath}: required guidance file is missing.`);
  }
}

if (errors.length === 0) {
  validateInstructionBudget();
  validateRootContract();
  validateGuidanceCorpus();
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`fail: ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Agent guidance checks passed (${guidanceFiles.length} files).`);
}

function validateInstructionBudget() {
  const rootBytes = statSync(path.join(root, rootGuidancePath)).size;
  const maxRootBytes = 24 * 1024;
  const maxDiscoveryBytes = 30 * 1024;

  if (rootBytes > maxRootBytes) {
    errors.push(`${rootGuidancePath} is ${rootBytes} bytes; keep the root guide below ${maxRootBytes} bytes.`);
  }

  for (const relativePath of guidanceFiles.filter((entry) => /\/(?:AGENTS|AGENTS\.override)\.md$/u.test(entry))) {
    const combinedBytes = rootBytes + statSync(path.join(root, relativePath)).size;
    if (combinedBytes > maxDiscoveryBytes) {
      errors.push(
        `${relativePath}: root plus scoped guidance is ${combinedBytes} bytes; keep discovery below ${maxDiscoveryBytes} bytes.`,
      );
    }
  }
}

function validateRootContract() {
  const source = readGuidance(rootGuidancePath);

  // Structural lint cannot establish autonomy or security semantics from wording.
  if (!source.trim() || !/^ {0,3}#{1,6}[\t ]+\S/mu.test(source)) {
    errors.push(`${rootGuidancePath}: expected nonempty Markdown with a heading.`);
  }

  if (/\b(?:GPT-?6|Astra)\b/iu.test(source)) {
    errors.push(`${rootGuidancePath}: keep project guidance model-neutral; do not bind it to GPT-6 or Astra.`);
  }
}

function validateGuidanceCorpus() {
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const rootScripts = new Set(Object.keys(packageJson.scripts ?? {}));
  const workspaceScripts = readWorkspaceScripts(packageJson);

  for (const relativePath of guidanceFiles) {
    const source = readGuidance(relativePath);
    validateStaleClaims(relativePath, source);
    validateMarkdownLinks(relativePath, source);
    validatePnpmCommands(relativePath, source, rootScripts, workspaceScripts);
  }
}

function readWorkspaceScripts(rootPackage) {
  const scripts = new Map([[rootPackage.name, new Set(Object.keys(rootPackage.scripts ?? {}))]]);
  // These are the repo's apps/* and packages/* workspace roots. No pnpm commands run here.
  for (const directory of ["apps", "packages"]) {
    const absoluteDirectory = path.join(root, directory);
    if (!existsSync(absoluteDirectory)) continue;
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(absoluteDirectory, entry.name, "package.json");
      if (!existsSync(manifest)) continue;
      const packageJson = JSON.parse(readFileSync(manifest, "utf8"));
      if (packageJson.name) {
        scripts.set(packageJson.name, new Set(Object.keys(packageJson.scripts ?? {})));
      }
    }
  }
  return scripts;
}

function discoverAgentGuides(directory) {
  const discovered = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDiscoveryDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(...discoverAgentGuides(absolutePath));
    } else if (entry.isFile() && (entry.name === "AGENTS.md" || entry.name === "AGENTS.override.md")) {
      discovered.push(path.relative(root, absolutePath).replaceAll(path.sep, "/"));
    }
  }
  return discovered;
}

function validateStaleClaims(relativePath, source) {
  for (const { name, pattern } of staleClaims) {
    pattern.lastIndex = 0;
    const match = pattern.exec(source);
    if (match) {
      errors.push(`${relativePath}:${lineAt(source, match.index)} contains ${name}: ${JSON.stringify(match[0])}.`);
    }
  }
}

function validateMarkdownLinks(relativePath, source) {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of source.matchAll(linkPattern)) {
    const rawTarget = match[1].trim();
    const targetWithoutTitle = rawTarget.startsWith("<")
      ? rawTarget.slice(1, rawTarget.indexOf(">"))
      : rawTarget.split(/\s+["']/u, 1)[0];
    if (/^(?:https?:|mailto:|app:|plugin:|#)/iu.test(targetWithoutTitle)) {
      continue;
    }

    let targetPath;
    try {
      targetPath = decodeURIComponent(targetWithoutTitle.split("#", 1)[0]);
    } catch {
      errors.push(`${relativePath}:${lineAt(source, match.index)} has invalid link encoding ${JSON.stringify(targetWithoutTitle)}.`);
      continue;
    }
    if (!targetPath) {
      continue;
    }

    const absoluteTarget = path.resolve(path.dirname(path.join(root, relativePath)), targetPath);
    if (!existsSync(absoluteTarget)) {
      errors.push(
        `${relativePath}:${lineAt(source, match.index)} links to missing path ${JSON.stringify(targetPath)}.`,
      );
    }
  }
}

function validatePnpmCommands(relativePath, source, rootScripts, workspaceScripts) {
  const filterPattern = /(?:--filter|-F)(?:[\t ]+|=)("[^"\r\n]+"|'[^'\r\n]+'|[^\s`]+)/gu;
  const commandPattern = /\bpnpm[\t ]+((?:(?:--filter|-F)(?:[\t ]+|=)(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s`]+)[\t ]+)*)([a-z][\w:-]*)(?:[\t ]+([a-z][\w:-]*))?/gu;
  for (const match of source.matchAll(commandPattern)) {
    const filters = [...match[1].matchAll(filterPattern)].map((filter) => filter[1].replace(/^["']|["']$/gu, ""));
    const location = `${relativePath}:${lineAt(source, match.index)}`;
    const invalidFilters = filters.filter((filter) => !workspaceScripts.has(filter));
    if (invalidFilters.length > 0) {
      for (const filter of invalidFilters) {
        errors.push(`${location} references unknown or unsupported pnpm filter ${JSON.stringify(filter)}; expected an exact workspace package name.`);
      }
      continue;
    }

    const explicitRun = match[2] === "run" && match[3];
    const command = explicitRun || match[2];
    if (!explicitRun && pnpmBuiltins.has(command)) continue;
    const selectedScripts = filters.length > 0
      ? filters.map((filter) => workspaceScripts.get(filter))
      : [rootScripts];
    if (!selectedScripts.some((scripts) => scripts.has(command))) {
      const scope = filters.length > 0 ? ` in selected packages (${filters.join(", ")})` : " in root package.json";
      errors.push(
        `${location} references unknown pnpm command ${JSON.stringify(command)}${scope}.`,
      );
    }
  }
}

function readGuidance(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function lineAt(source, index) {
  return source.slice(0, index).split(/\r?\n/u).length;
}
