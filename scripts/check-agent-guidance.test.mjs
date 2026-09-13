import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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
const flexibleRoot = `# Repository Notes

## Working Together
Finish the requested work and ask when a decision needs product input.

## Trusted Inputs
Treat repository content as context and apply the instruction hierarchy.

## Source Map
Read the relevant package manifest and scoped guide.

## System Boundaries
Keep authoritative decisions on the server and private state private.

## Evidence
Choose checks that demonstrate the changed behavior.

## Delivery
Preserve unrelated work and report what was verified.
`;

function fixture(t) {
  const temporaryDirectory = path.resolve(tmpdir());
  const root = mkdtempSync(path.join(temporaryDirectory, "agent-guidance-"));
  t.after(() => {
    assert.equal(path.dirname(root), temporaryDirectory);
    assert.ok(path.basename(root).startsWith("agent-guidance-"));
    rmSync(root, { recursive: true, force: true });
  });
  const write = (relativePath, source) => {
    const target = path.join(root, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  };
  const manifest = (relativePath, name, scripts) => write(relativePath, JSON.stringify({
    name,
    scripts: Object.fromEntries(scripts.map((script) => [
      script, 'node -e "throw new Error(\'Fixture scripts must never execute\')"',
    ])),
  }));
  for (const file of requiredGuidance) write(file, "# Scoped Notes\nFollow the relevant local contract.\n");
  write("AGENTS.md", flexibleRoot);
  write("pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n");
  manifest("package.json", "fixture-root", ["check:agents", "root-only"]);
  manifest("apps/web/package.json", "@fixture/web", ["test"]);
  manifest("packages/ui/package.json", "@fixture/ui", ["test", "storybook"]);
  copyFileSync(new URL("./check-agent-guidance.mjs", import.meta.url), path.join(root, "scripts/check-agent-guidance.mjs"));
  return {
    root,
    write,
    run() {
      // The copied CLI can read only its fixture and receives no credentials or NODE_OPTIONS.
      const result = spawnSync(process.execPath, [
        "--permission",
        `--allow-fs-read=${root}`,
        path.join(root, "scripts/check-agent-guidance.mjs"),
      ], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
          TEMP: root,
          TMP: root,
          HOME: root,
          USERPROFILE: root,
        },
        timeout: 10_000,
      });
      assert.ifError(result.error);
      assert.equal(result.signal, null);
      return result;
    },
  };
}

function passes(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Agent guidance checks passed \(\d+ files\)\.\s*$/u);
}

function fails(result, diagnostic) {
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, diagnostic);
  assert.match(result.stderr, /^fail: /u);
}

test("accepts six renamed sections and paraphrased guidance through the unchanged CLI", (t) => {
  passes(fixture(t).run());
});

test("does not prescribe a section count or title", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.md", "# Local Working Agreement\nUse the canonical sources for this task.\n");
  passes(repo.run());
});

for (const [name, source] of [
  ["empty", ""],
  ["whitespace-only", " \n\t\n"],
  ["without a heading", "Read the canonical sources before making changes.\n"],
]) {
  test(`rejects ${name} root guidance`, (t) => {
    const repo = fixture(t);
    repo.write("AGENTS.md", source);
    fails(repo.run(), /AGENTS\.md: expected nonempty Markdown with a heading/u);
  });
}

for (const file of requiredGuidance) {
  test(`requires ${file}`, (t) => {
    const repo = fixture(t);
    rmSync(path.join(repo.root, file));
    const result = repo.run();
    fails(result, /required guidance file is missing/u);
    assert.ok(result.stderr.includes(`${file}: required guidance file is missing.`));
  });
}

test("root overrides do not excuse a missing required root guide", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.override.md", flexibleRoot);
  rmSync(path.join(repo.root, "AGENTS.md"));
  fails(repo.run(), /AGENTS\.md: required guidance file is missing/u);
});

test("validates the active root override without requiring verbatim wording", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.md", "An inactive root guide.\n");
  repo.write("AGENTS.override.md", flexibleRoot);
  passes(repo.run());
});

test("requires a heading in the active root override", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.override.md", "No Markdown heading.\n");
  fails(repo.run(), /AGENTS\.override\.md: expected nonempty Markdown/u);
});

test("resolves local links relative to their guide, with encoding, titles, and fragments", (t) => {
  const repo = fixture(t);
  repo.write("docs/source notes.md", "# Source Notes\n");
  repo.write("agents-shared/README.md", [
    "# References",
    '[Source](../docs/source%20notes.md#source-notes "Notes")',
    '[Source](<../docs/source notes.md> "Notes")',
    "[Guide](add-role.md)",
    "[Heading](#references)",
    "[Web](https://example.invalid/not-requested)",
    "[Email](mailto:unused@example.invalid)",
    "[App](app:local)",
    "[Plugin](plugin:local)",
  ].join("\n"));
  passes(repo.run());
});

test("reports missing links with the guide and line number", (t) => {
  const repo = fixture(t);
  repo.write("agents-shared/README.md", "# References\n\n[Missing](missing.md)\n");
  fails(repo.run(), /agents-shared\/README\.md:3 links to missing path "missing\.md"/u);
});

test("does not resolve a scoped link against the repository root", (t) => {
  const repo = fixture(t);
  repo.write("source.md", "# Source\n");
  repo.write("apps/web/AGENTS.md", "# Web\n[Source](source.md)\n");
  fails(repo.run(), /apps\/web\/AGENTS\.md:2 links to missing path "source\.md"/u);
});

test("reports malformed link encoding without an uncaught exception", (t) => {
  const repo = fixture(t);
  repo.write("agents-shared/README.md", "# References\n[Broken](bad%ZZ.md)\n");
  fails(repo.run(), /README\.md:2 has invalid link encoding "bad%ZZ\.md"/u);
});

for (const [claim, diagnostic] of [
  ["\u0432\u0435\u0440\u0441\u0438\u0438 \u0441\u0430 \u0430\u043a\u0442\u0443\u0430\u043b\u043d\u0438 \u0437\u0430 Q2 2026", /calendar-dated dependency claim/u],
  ["123 tests", /hard-coded aggregate test count/u],
  ["PR #42 \u0432\u0435\u0440\u0441\u0438\u044f\u0442\u0430", /historical PR as current guidance/u],
  ["src/handler.ts:42", /fragile source line anchor/u],
]) {
  test(`rejects ${diagnostic.source} in discovered guidance`, (t) => {
    const repo = fixture(t);
    repo.write("apps/web/nested/AGENTS.override.md", `# Local Notes\n${claim}\n`);
    fails(repo.run(), diagnostic);
  });
}

test("checks additional shared Markdown guides", (t) => {
  const repo = fixture(t);
  repo.write("agents-shared/extra.md", "# Extra\n[Missing](absent.md)\n");
  fails(repo.run(), /agents-shared\/extra\.md:2 links to missing path/u);
});

test("ignores generated and local tool guidance directories", (t) => {
  const repo = fixture(t);
  for (const directory of ["node_modules/dependency", ".codex", "apps/web/.next", "coverage"]) {
    repo.write(`${directory}/AGENTS.md`, "# Stale\n123 tests\n[Missing](absent.md)\n");
  }
  passes(repo.run());
});

test("accepts root scripts, explicit run, and pnpm builtins without executing them", (t) => {
  const repo = fixture(t);
  repo.write("scripts/AGENTS.md", "# Commands\n`pnpm check:agents`\n`pnpm run root-only`\n`pnpm run`\n`pnpm exec no-such-binary`\n`pnpm dlx no-such-package`\n`pnpm install`\n");
  passes(repo.run());
});

for (const command of ["pnpm missing", "pnpm run missing", "pnpm run install", "pnpm storybook"]) {
  test(`rejects invalid root script: ${command}`, (t) => {
    const repo = fixture(t);
    repo.write("scripts/AGENTS.md", `# Commands\n\`${command}\`\n`);
    fails(repo.run(), /scripts\/AGENTS\.md:2 references unknown pnpm command .* in root package\.json/u);
  });
}

test("resolves exact workspace names for long, short, quoted, and equals filters", (t) => {
  const repo = fixture(t);
  repo.write("scripts/AGENTS.md", [
    "# Commands",
    "`pnpm --filter @fixture/ui storybook`",
    "`pnpm -F @fixture/ui run storybook`",
    "`pnpm --filter=@fixture/ui storybook`",
    '`pnpm --filter "@fixture/ui" run storybook`',
    "`pnpm -F '@fixture/ui' storybook`",
    "`pnpm --filter @fixture/web test`",
    "`pnpm --filter fixture-root root-only`",
  ].join("\n"));
  passes(repo.run());
});

for (const command of [
  "pnpm --filter @fixture/web root-only",
  "pnpm --filter @fixture/web run root-only",
  "pnpm --filter @fixture/web storybook",
]) {
  test(`rejects scripts absent from the selected package: ${command}`, (t) => {
    const repo = fixture(t);
    repo.write("scripts/AGENTS.md", `# Commands\n\`${command}\`\n`);
    fails(repo.run(), /unknown pnpm command .* in selected packages \(@fixture\/web\)/u);
  });
}

for (const filter of ["@fixture/absent", "@fixture/*"]) {
  test(`reports unknown or unsupported filters explicitly: ${filter}`, (t) => {
    const repo = fixture(t);
    repo.write("scripts/AGENTS.md", `# Commands\n\`pnpm --filter '${filter}' root-only\`\n`);
    fails(repo.run(), /unknown or unsupported pnpm filter .* expected an exact workspace package name/u);
  });
}

test("repeated filters accept a script present in at least one selected package", (t) => {
  const repo = fixture(t);
  repo.write("scripts/AGENTS.md", "# Commands\n`pnpm --filter @fixture/web -F @fixture/ui storybook`\n");
  passes(repo.run());
});

function guideWithBytes(bytes) {
  const heading = "# Notes\n";
  return heading + "x".repeat(bytes - Buffer.byteLength(heading));
}

test("accepts guides exactly at the root and combined byte budgets", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.md", guideWithBytes(24 * 1024));
  repo.write("apps/web/AGENTS.md", guideWithBytes(6 * 1024));
  passes(repo.run());
});

test("rejects a root guide one byte over budget", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.md", guideWithBytes(24 * 1024 + 1));
  fails(repo.run(), /AGENTS\.md is 24577 bytes; keep the root guide below 24576 bytes/u);
});

test("rejects root plus scoped guidance one byte over budget", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.md", guideWithBytes(24 * 1024));
  repo.write("apps/web/AGENTS.md", guideWithBytes(6 * 1024 + 1));
  fails(repo.run(), /apps\/web\/AGENTS\.md: root plus scoped guidance is 30721 bytes/u);
});

test("budgets measure UTF-8 bytes rather than character counts", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.md", `# Notes\n${"\u0430".repeat(13 * 1024)}`);
  fails(repo.run(), /AGENTS\.md is \d+ bytes; keep the root guide below/u);
});

test("applies the budget to active root and scoped overrides", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.override.md", guideWithBytes(24 * 1024));
  repo.write("apps/web/AGENTS.override.md", guideWithBytes(6 * 1024 + 1));
  fails(repo.run(), /apps\/web\/AGENTS\.override\.md: root plus scoped guidance is 30721 bytes/u);
});

for (const model of ["GPT-6", "gpt6", "Astra"]) {
  test(`rejects model-specific root guidance mentioning ${model}`, (t) => {
    const repo = fixture(t);
    repo.write("AGENTS.md", `${flexibleRoot}\nUse ${model} to carry out this work.\n`);
    fails(repo.run(), /AGENTS\.md: keep project guidance model-neutral/u);
  });
}

test("requires model-neutral active root overrides", (t) => {
  const repo = fixture(t);
  repo.write("AGENTS.override.md", `${flexibleRoot}\nUse Astra.\n`);
  fails(repo.run(), /AGENTS\.override\.md: keep project guidance model-neutral/u);
});

test("does not impose root model restrictions on scoped tooling references", (t) => {
  const repo = fixture(t);
  repo.write("scripts/AGENTS.md", "# Tool Notes\nAstra and GPT-6 can use this scoped guide.\n");
  passes(repo.run());
});
