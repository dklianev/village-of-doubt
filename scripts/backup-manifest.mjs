#!/usr/bin/env node

import { createHash, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from "node:crypto";
import { basename, dirname } from "node:path";
import { readFile, rename, stat, writeFile } from "node:fs/promises";

const MANIFEST_SUFFIX = ".manifest.json";
const SIGNATURE_SUFFIX = ".sig";

async function sha256File(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function parseNonNegativeInteger(value, label) {
  if (!/^\d+$/.test(value ?? "")) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return Number(value);
}

function equalText(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isValidProvenance(value) {
  return typeof value === "string"
    && value.length >= 4
    && !/^(?:unknown|unavailable|latest|local|main)$/i.test(value)
    && !/replace|change-me|placeholder/i.test(value);
}

async function createManifest([artifact, privateKeyFile, database, releaseVersion, migrationHead]) {
  if (!artifact || !privateKeyFile || !database || !releaseVersion || !migrationHead) {
    throw new Error("Usage: backup-manifest.mjs create <artifact> <private-key> <database> <release> <migration-head>");
  }
  if (!isValidProvenance(releaseVersion) || !isValidProvenance(migrationHead)) {
    throw new Error("Backup provenance must contain an immutable release and exact migration head.");
  }

  const artifactStats = await stat(artifact);
  if (!artifactStats.isFile() || artifactStats.size <= 0) {
    throw new Error("Backup artifact must be a non-empty file.");
  }
  const manifest = {
    schemaVersion: 1,
    artifact: basename(artifact),
    sha256: await sha256File(artifact),
    sizeBytes: artifactStats.size,
    createdAt: new Date().toISOString(),
    database,
    releaseVersion,
    migrationHead,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  const privateKey = createPrivateKey(await readFile(privateKeyFile));
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Backup signing key must be an Ed25519 private key.");
  }
  const signature = sign(null, manifestBytes, privateKey).toString("base64");
  const manifestPath = `${artifact}${MANIFEST_SUFFIX}`;
  const signaturePath = `${manifestPath}${SIGNATURE_SUFFIX}`;
  const manifestTemp = `${manifestPath}.tmp`;
  const signatureTemp = `${signaturePath}.tmp`;
  await writeFile(manifestTemp, manifestBytes, { mode: 0o600 });
  await writeFile(signatureTemp, `${signature}\n`, { mode: 0o600 });
  await rename(manifestTemp, manifestPath);
  await rename(signatureTemp, signaturePath);
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

async function verifyManifest([artifact, publicKeyFile, expectedDatabase, maxAgeHoursRaw, clockSkewSecondsRaw]) {
  if (!artifact || !publicKeyFile || !expectedDatabase || maxAgeHoursRaw === undefined || clockSkewSecondsRaw === undefined) {
    throw new Error("Usage: backup-manifest.mjs verify <artifact> <public-key> <database> <max-age-hours> <clock-skew-seconds>");
  }
  const maxAgeHours = parseNonNegativeInteger(maxAgeHoursRaw, "max-age-hours");
  const clockSkewSeconds = parseNonNegativeInteger(clockSkewSecondsRaw, "clock-skew-seconds");
  const manifestPath = `${artifact}${MANIFEST_SUFFIX}`;
  const signaturePath = `${manifestPath}${SIGNATURE_SUFFIX}`;
  const manifestBytes = await readFile(manifestPath);
  const signature = Buffer.from((await readFile(signaturePath, "utf8")).trim(), "base64");
  const publicKey = createPublicKey(await readFile(publicKeyFile));
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Backup verification key must be an Ed25519 public key.");
  }
  if (!verify(null, manifestBytes, publicKey, signature)) {
    throw new Error("Backup manifest signature is invalid.");
  }

  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const expectedKeys = [
    "artifact",
    "createdAt",
    "database",
    "migrationHead",
    "releaseVersion",
    "schemaVersion",
    "sha256",
    "sizeBytes",
  ];
  if (
    !manifest
    || typeof manifest !== "object"
    || Array.isArray(manifest)
    || JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(expectedKeys)
    || manifest.schemaVersion !== 1
    || manifest.artifact !== basename(artifact)
    || manifest.database !== expectedDatabase
    || typeof manifest.sha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(manifest.sha256)
    || !Number.isSafeInteger(manifest.sizeBytes)
    || manifest.sizeBytes <= 0
    || !isValidProvenance(manifest.releaseVersion)
    || !isValidProvenance(manifest.migrationHead)
  ) {
    throw new Error("Backup manifest fields are invalid.");
  }

  const artifactStats = await stat(artifact);
  if (!artifactStats.isFile() || artifactStats.size !== manifest.sizeBytes) {
    throw new Error("Backup artifact size does not match the signed manifest.");
  }
  const actualHash = await sha256File(artifact);
  if (!equalText(actualHash, manifest.sha256)) {
    throw new Error("Backup artifact hash does not match the signed manifest.");
  }

  const createdAt = Date.parse(manifest.createdAt);
  if (!Number.isFinite(createdAt) || new Date(createdAt).toISOString() !== manifest.createdAt) {
    throw new Error("Backup manifest timestamp is invalid.");
  }
  const ageMs = Date.now() - createdAt;
  if (ageMs < -clockSkewSeconds * 1_000) {
    throw new Error("Backup manifest timestamp is beyond the allowed clock skew.");
  }
  if (ageMs > maxAgeHours * 60 * 60 * 1_000) {
    throw new Error("Backup manifest is older than the allowed maximum age.");
  }

  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}

const [, , command, ...args] = process.argv;

try {
  if (command === "create") {
    await createManifest(args);
  } else if (command === "verify") {
    await verifyManifest(args);
  } else {
    throw new Error("Expected create or verify command.");
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
