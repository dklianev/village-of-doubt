#!/usr/bin/env node
/**
 * Audits class selectors in apps/web/app/globals.css against app source usage.
 *
 * This is intentionally conservative: it reports likely dead selectors, but it
 * does not rewrite CSS. Use --budget in regression to keep the global sheet from
 * growing back while route/component styles move into CSS modules over time.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const globalsPath = path.join(root, "apps/web/app/globals.css");
const sourceRoots = ["apps/web/app", "apps/web/components", "apps/web/lib"].map((relative) =>
  path.join(root, relative),
);

const MAX_GLOBALS_LINES = 19_500;
const MAX_GLOBALS_BYTES = 470_000;
const KNOWN_DYNAMIC_CLASS_PATTERNS = [
  /^ability-/,
  /^connection-/,
  /^faction-/,
  /^mode-/,
  /^phase-/,
  /^role-/,
  /^transition-/,
  /^faq-block-callout-/,
  /^game-choice-(mafia|werewolf)$/,
  /^ds-pill$/,
];

const args = new Set(process.argv.slice(2));
const css = readText(globalsPath);
const sourceFiles = sourceRoots.flatMap((dir) => listFilesRecursive(dir)).filter((file) => /\.(tsx|ts|mdx?)$/.test(file));
const sourceTexts = sourceFiles.map((file) => [file, readText(file)]);
const classNames = collectCssClassSelectors(css);
const lineCount = css.split(/\r?\n/).length;
const byteCount = Buffer.byteLength(css, "utf8");

const report = [...classNames]
  .sort()
  .map((className) => ({
    className,
    refs: countSourceRefs(className, sourceTexts),
    ignoredDynamic: isKnownDynamicClass(className),
  }));
const likelyDead = report.filter((item) => item.refs === 0 && !item.ignoredDynamic);
const ignoredDynamic = report.filter((item) => item.refs === 0 && item.ignoredDynamic);

if (args.has("--budget")) {
  const failures = [];
  if (lineCount > MAX_GLOBALS_LINES) {
    failures.push(`globals.css has ${lineCount} lines; budget is ${MAX_GLOBALS_LINES}.`);
  }
  if (byteCount > MAX_GLOBALS_BYTES) {
    failures.push(`globals.css is ${byteCount} bytes; budget is ${MAX_GLOBALS_BYTES}.`);
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

if (args.has("--json")) {
  process.stdout.write(
    `${JSON.stringify(
      {
        file: path.relative(root, globalsPath).replaceAll("\\", "/"),
        lineCount,
        byteCount,
        selectorCount: report.length,
        zeroRefCount: likelyDead.length,
        ignoredDynamicZeroRefCount: ignoredDynamic.length,
        report,
      },
      null,
      2,
    )}\n`,
  );
} else if (args.has("--zero-refs")) {
  for (const item of likelyDead) {
    process.stdout.write(`${item.className}\n`);
  }
} else {
  console.log(`globals.css: ${lineCount} lines, ${byteCount} bytes`);
  console.log(`class selectors: ${report.length}`);
  console.log(`likely zero-ref selectors: ${likelyDead.length}`);
  console.log(`ignored dynamic zero-ref selectors: ${ignoredDynamic.length}`);
  console.log("Use --zero-refs or --json for details.");
}

function collectCssClassSelectors(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = new Set();
  const rulePattern = /([^{}]+)\{/g;
  let match;

  while ((match = rulePattern.exec(withoutComments))) {
    const prelude = match[1]?.trim() ?? "";
    if (!prelude || prelude.startsWith("@") || /^(from|to|\d+%)/.test(prelude)) {
      continue;
    }

    const classPattern = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
    let classMatch;
    while ((classMatch = classPattern.exec(prelude))) {
      const className = classMatch[1];
      if (className) {
        selectors.add(className);
      }
    }
  }

  return selectors;
}

function countSourceRefs(className, files) {
  const literalPattern = new RegExp(`(^|[^_a-zA-Z0-9-])${escapeRegExp(className)}([^_a-zA-Z0-9-]|$)`);
  let refs = 0;

  for (const [, text] of files) {
    if (literalPattern.test(text)) {
      refs += 1;
    }
  }

  return refs;
}

function isKnownDynamicClass(className) {
  return KNOWN_DYNAMIC_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}

function listFilesRecursive(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if ([".next", "node_modules", "__visual__", "__tests__"].includes(entry.name)) {
      return [];
    }

    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursive(absolute);
    }

    return entry.isFile() ? [absolute] : [];
  });
}

function readText(file) {
  return readFileSync(file, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
