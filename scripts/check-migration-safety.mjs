import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BLOCKED_PATTERNS = [
  ["drop table", /\bDROP\s+TABLE\b/i],
  ["drop column", /\bDROP\s+COLUMN\b/i],
  ["drop type", /\bDROP\s+TYPE\b/i],
  ["truncate", /\bTRUNCATE\b/i],
  ["rename table or column", /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\b/i],
  ["change column type", /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i],
  ["set column not null", /\bALTER\s+COLUMN\b[\s\S]*?\bSET\s+NOT\s+NULL\b/i],
  ["delete data", /\bDELETE\s+FROM\b/i],
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

export function evaluateMigrationSafety({ journal, migrations, policy }) {
  if (policy?.schemaVersion !== 1 || typeof policy.baselineTag !== "string") {
    throw new Error("migration-policy.json must declare schemaVersion 1 and baselineTag");
  }
  if (!Array.isArray(journal?.entries)) {
    throw new Error("Drizzle journal entries are missing");
  }

  const baselineIndex = journal.entries.findIndex((entry) => entry.tag === policy.baselineTag);
  if (baselineIndex < 0) {
    throw new Error(`Migration policy baseline ${policy.baselineTag} is not present in the Drizzle journal`);
  }

  const approvals = policy.approvedDestructiveMigrations ?? {};
  const knownTags = new Set(journal.entries.map((entry) => entry.tag));
  for (const [tag, approval] of Object.entries(approvals)) {
    if (!knownTags.has(tag)) {
      throw new Error(`Destructive migration approval references unknown tag ${tag}`);
    }
    validateApproval(tag, approval);
  }

  const results = [];
  for (const entry of journal.entries.slice(baselineIndex + 1)) {
    const source = migrations[entry.tag];
    if (typeof source !== "string") {
      throw new Error(`Migration SQL is missing for ${entry.tag}`);
    }

    const findings = findBlockedOperations(source);
    const approval = approvals[entry.tag];
    if (findings.length > 0 && !approval) {
      throw new Error(
        `${entry.tag} contains rollback-breaking operations (${findings.join(", ")}). ` +
          "Use an expand/contract migration or add a reviewed maintenance approval with a restore plan.",
      );
    }
    if (approval) {
      validateApproval(entry.tag, approval);
    }
    results.push({ tag: entry.tag, findings, approved: findings.length > 0 && Boolean(approval) });
  }

  return results;
}

export function findBlockedOperations(source) {
  const sql = stripSqlComments(source);
  return BLOCKED_PATTERNS
    .filter(([, pattern]) => pattern.test(sql))
    .map(([label]) => label);
}

function validateApproval(tag, approval) {
  if (
    !approval ||
    approval.mode !== "maintenance" ||
    approval.backupRequired !== true ||
    typeof approval.reason !== "string" ||
    approval.reason.trim().length < 20 ||
    typeof approval.rollbackPlan !== "string" ||
    approval.rollbackPlan.trim().length < 30
  ) {
    throw new Error(
      `Approval for ${tag} must use maintenance mode, require a backup, and document reason and rollbackPlan`,
    );
  }
}

function stripSqlComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

function runCli() {
  const root = path.resolve(process.env.MIGRATION_SAFETY_ROOT ?? process.cwd());
  const drizzleDir = path.join(root, "packages/database/drizzle");
  const journal = readJson(path.join(drizzleDir, "meta/_journal.json"));
  const policy = readJson(path.join(drizzleDir, "migration-policy.json"));
  const migrations = Object.fromEntries(
    journal.entries.map((entry) => [
      entry.tag,
      readFileSync(path.join(drizzleDir, `${entry.tag}.sql`), "utf8"),
    ]),
  );

  try {
    const results = evaluateMigrationSafety({ journal, migrations, policy });
    for (const result of results) {
      if (result.approved) {
        console.warn(`warning: ${result.tag} is an approved maintenance migration: ${result.findings.join(", ")}`);
      } else {
        console.log(`ok: ${result.tag} is expand/contract compatible`);
      }
    }
    console.log(`Migration safety policy passed from baseline ${policy.baselineTag}.`);
  } catch (error) {
    console.error(`Migration safety error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
