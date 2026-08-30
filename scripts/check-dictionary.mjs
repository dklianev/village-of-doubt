#!/usr/bin/env node
/**
 * Dictionary check (audit-only, non-fatal).
 * Scans .tsx/.ts for English JSX text and anglicisms.
 * Always exits 0. Run: pnpm check:dict
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const ROOT = process.cwd();

const RULES = [
  { pattern: />\s*Login\s*</g, hint: "-> „Влез\"", legacy: false },
  { pattern: />\s*Logout\s*</g, hint: "-> „Излез\"", legacy: false },
  { pattern: />\s*Sign[ -]?up\s*</g, hint: "-> „Нов профил\"", legacy: false },
  { pattern: />\s*Submit\s*</g, hint: "-> „Прати\" / „Запази\"", legacy: false },
  { pattern: />\s*Cancel\s*</g, hint: "-> „Откажи\"", legacy: false },
  { pattern: />\s*Confirm\s*</g, hint: "-> „Потвърди\"", legacy: false },
  { pattern: />\s*Save\s*</g, hint: "-> „Запази\"", legacy: false },
  { pattern: />\s*Delete\s*</g, hint: "-> „Изтрий\"", legacy: false },
  { pattern: />\s*OK\s*</g, hint: "-> „Добре\"", legacy: false },
  { pattern: />\s*Continue\s*</g, hint: "-> „Продължи\"", legacy: false },
  { pattern: />\s*Loading\.{3}\s*</g, hint: "-> „Зареждаме...\"", legacy: false },
  { pattern: /Логин(а|ът|и|ите)?/g, hint: "-> „Влизане\"", legacy: false },
  { pattern: /Аватар(а|ът|и|ите)?/g, hint: "-> „Портрет\"", legacy: false },
  {
    pattern: /(?<![\p{L}\p{N}_])Чат(?:а|ът|ове|овете)?(?![\p{L}\p{N}_])/giu,
    hint: "-> „Разговор\"",
    legacy: false,
  },
  { pattern: /Постижения/g, hint: "spec: „Легенди\" (legacy-OK)", legacy: true },
  { pattern: /Класация/g, hint: "spec: „Вечерен брой\" (legacy-OK)", legacy: true },
  {
    pattern: /Често задавани въпроси/g,
    hint: "spec: „Седни до огъня\" (legacy-OK)",
    legacy: true,
  },
];

const SCAN_DIRS = process.argv.length > 2
  ? process.argv.slice(2)
  : [
      "apps/web/app",
      "apps/web/components",
      "apps/web/lib",
      "apps/game-server/src",
      "packages/shared/src",
    ];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "__tests__", "__visual__"]);
const SCAN_EXT = new Set([".tsx", ".ts"]);

let warnings = 0;
let legacyHits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (SCAN_EXT.has(extname(entry))) checkFile(full);
  }
}

function checkFile(path) {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(path)) return;
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = line.match(rule.pattern);
      if (match) {
        const tag = rule.legacy ? "\x1b[33m[legacy]\x1b[0m" : "\x1b[31m[warn]\x1b[0m";
        const rel = path.replace(`${ROOT}/`, "").replace(`${ROOT}\\`, "");
        process.stdout.write(`${tag} ${rel}:${i + 1}  "${match[0]}" - ${rule.hint}\n`);
        if (rule.legacy) legacyHits++;
        else warnings++;
      }
    }
  }
}

console.log("\nDictionary check (audit-only) - Path Б\n");
for (const dir of SCAN_DIRS) walk(resolve(ROOT, dir));
console.log(`\nSummary: ${warnings} hard warnings, ${legacyHits} legacy-OK hits.\nExit code 0.\n`);
process.exit(0);
