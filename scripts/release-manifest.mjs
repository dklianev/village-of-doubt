import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

export function validateReleaseManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("manifest must be an object");
  }

  const releaseVersion = requireReleaseVersion(value.releaseVersion);
  const migrationHead = requireToken(value.migrationHead, "migrationHead");
  const images = value.images;
  if (!images || typeof images !== "object" || Array.isArray(images)) {
    throw new Error("images must be an object");
  }

  return {
    schemaVersion: value.schemaVersion === 1 ? 1 : invalid("schemaVersion must be 1"),
    releaseVersion,
    migrationHead,
    sourceCommit: requireCommit(value.sourceCommit, "sourceCommit"),
    createdAt: requireIsoDate(value.createdAt),
    images: {
      web: requireDigestImage(images.web, "images.web"),
      game: requireDigestImage(images.game, "images.game"),
      migrator: requireDigestImage(images.migrator, "images.migrator"),
    },
  };
}

function requireReleaseVersion(value) {
  const token = requireToken(value, "releaseVersion");
  if (!/^[a-f0-9]{40}$/i.test(token)) {
    throw new Error("releaseVersion must be the full 40-character Git commit SHA");
  }
  return token.toLowerCase();
}

function requireCommit(value, label) {
  const token = requireToken(value, label);
  if (!/^[a-f0-9]{40}$/i.test(token)) {
    throw new Error(`${label} must be a full Git commit SHA`);
  }
  return token.toLowerCase();
}

function requireDigestImage(value, label) {
  const token = requireToken(value, label);
  if (!/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/i.test(token)) {
    throw new Error(`${label} must be an immutable container reference with a sha256 digest`);
  }
  return token;
}

function requireIsoDate(value) {
  const token = requireToken(value, "createdAt");
  if (!Number.isFinite(Date.parse(token))) {
    throw new Error("createdAt must be an ISO date");
  }
  return token;
}

function requireToken(value, label) {
  if (typeof value !== "string" || !value || !/^[^\s"'`$\\]+$/.test(value)) {
    throw new Error(`${label} contains an unsafe or empty value`);
  }
  return value;
}

function invalid(reason) {
  throw new Error(reason);
}

function fail(reason) {
  console.error(`Release manifest error: ${reason}`);
  process.exit(1);
}

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function runCli() {
  const manifestPath = process.argv[2];
  const envOutputIndex = process.argv.indexOf("--env-output");
  const envOutputPath = envOutputIndex >= 0 ? process.argv[envOutputIndex + 1] : null;

  if (!manifestPath) {
    fail("Usage: node scripts/release-manifest.mjs <release.json> [--env-output <path>]");
  }
  if (envOutputIndex >= 0 && !envOutputPath) {
    fail("--env-output requires a path.");
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.resolve(manifestPath), "utf8"));
  } catch (error) {
    fail(`Release manifest is not valid JSON: ${message(error)}`);
  }

  let normalized;
  try {
    normalized = validateReleaseManifest(manifest);
  } catch (error) {
    fail(message(error));
  }

  const envText = [
    `RELEASE_VERSION=${normalized.releaseVersion}`,
    `WEB_IMAGE=${normalized.images.web}`,
    `GAME_IMAGE=${normalized.images.game}`,
    `MIGRATOR_IMAGE=${normalized.images.migrator}`,
    `MIGRATION_HEAD=${normalized.migrationHead}`,
    "",
  ].join("\n");

  if (envOutputPath) {
    writeFileSync(path.resolve(envOutputPath), envText, { encoding: "utf8", mode: 0o600 });
  } else {
    process.stdout.write(envText);
  }
}
