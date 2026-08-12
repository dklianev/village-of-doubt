import { sign, verify } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

export function validateReleaseManifest(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("manifest must be an object");
  }

  const releaseVersion = requireReleaseVersion(value.releaseVersion);
  const migrationHead = requireToken(value.migrationHead, "migrationHead");
  const images = value.images;
  if (!images || typeof images !== "object" || Array.isArray(images)) {
    throw new Error("images must be an object");
  }

  const normalized = {
    schemaVersion: value.schemaVersion === 1 ? 1 : invalid("schemaVersion must be 1"),
    releaseVersion,
    migrationHead,
    sourceCommit: requireCommit(value.sourceCommit, "sourceCommit"),
    createdAt: requireIsoDate(value.createdAt),
    images: {
      web: requireDigestImage(images.web, "images.web", options.allowedImagePrefix),
      game: requireDigestImage(images.game, "images.game", options.allowedImagePrefix),
      migrator: requireDigestImage(images.migrator, "images.migrator", options.allowedImagePrefix),
    },
  };

  if (normalized.releaseVersion !== normalized.sourceCommit) {
    throw new Error("releaseVersion must match sourceCommit");
  }

  return normalized;
}

export function canonicalReleaseManifest(value, options = {}) {
  return `${JSON.stringify(validateReleaseManifest(value, options))}\n`;
}

export function signReleaseManifest(value, privateKey, options = {}) {
  return sign(null, Buffer.from(canonicalReleaseManifest(value, options)), privateKey).toString("base64");
}

export function verifyReleaseManifestSignature(value, signature, publicKey, options = {}) {
  if (typeof signature !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature.trim())) {
    throw new Error("release manifest signature must be base64 encoded");
  }
  const valid = verify(
    null,
    Buffer.from(canonicalReleaseManifest(value, options)),
    publicKey,
    Buffer.from(signature.trim(), "base64"),
  );
  if (!valid) {
    throw new Error("release manifest signature is invalid");
  }
  return true;
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

function requireDigestImage(value, label, allowedImagePrefix) {
  const token = requireToken(value, label);
  if (!/^[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$/i.test(token)) {
    throw new Error(`${label} must be an immutable container reference with a sha256 digest`);
  }
  if (allowedImagePrefix) {
    const normalizedPrefix = requireImagePrefix(allowedImagePrefix);
    if (!token.toLowerCase().startsWith(`${normalizedPrefix}/`)) {
      throw new Error(`${label} must use the allowed image prefix ${normalizedPrefix}/`);
    }
  }
  return token;
}

function requireImagePrefix(value) {
  const token = requireToken(value, "allowed image prefix").toLowerCase().replace(/\/$/, "");
  if (!/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*$/i.test(token)) {
    throw new Error("allowed image prefix must be a ghcr.io repository path");
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
  const signatureIndex = process.argv.indexOf("--signature");
  const signaturePath = signatureIndex >= 0 ? process.argv[signatureIndex + 1] : null;
  const publicKeyIndex = process.argv.indexOf("--public-key");
  const publicKeyPath = publicKeyIndex >= 0
    ? process.argv[publicKeyIndex + 1]
    : process.env.RELEASE_MANIFEST_PUBLIC_KEY ?? null;
  const privateKeyIndex = process.argv.indexOf("--sign-private-key");
  const privateKeyPath = privateKeyIndex >= 0 ? process.argv[privateKeyIndex + 1] : null;
  const signatureOutputIndex = process.argv.indexOf("--signature-output");
  const signatureOutputPath = signatureOutputIndex >= 0 ? process.argv[signatureOutputIndex + 1] : null;
  const imagePrefixIndex = process.argv.indexOf("--allowed-image-prefix");
  const allowedImagePrefix = imagePrefixIndex >= 0
    ? process.argv[imagePrefixIndex + 1]
    : process.env.RELEASE_ALLOWED_IMAGE_PREFIX ?? null;

  if (!manifestPath) {
    fail("Usage: node scripts/release-manifest.mjs <release.json> [--env-output <path>]");
  }
  if (envOutputIndex >= 0 && !envOutputPath) {
    fail("--env-output requires a path.");
  }
  if ((signaturePath && !publicKeyPath) || (!signaturePath && publicKeyPath)) {
    fail("--signature and --public-key must be provided together.");
  }
  if ((privateKeyPath && !signatureOutputPath) || (!privateKeyPath && signatureOutputPath)) {
    fail("--sign-private-key and --signature-output must be provided together.");
  }
  if ((signaturePath || privateKeyPath) && !allowedImagePrefix) {
    fail("Signed release manifests require --allowed-image-prefix.");
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.resolve(manifestPath), "utf8"));
  } catch (error) {
    fail(`Release manifest is not valid JSON: ${message(error)}`);
  }

  let normalized;
  try {
    normalized = validateReleaseManifest(manifest, { allowedImagePrefix });
  } catch (error) {
    fail(message(error));
  }

  try {
    if (signaturePath) {
      verifyReleaseManifestSignature(
        normalized,
        readFileSync(path.resolve(signaturePath), "utf8"),
        readFileSync(path.resolve(publicKeyPath), "utf8"),
        { allowedImagePrefix },
      );
    }
    if (privateKeyPath) {
      const signature = signReleaseManifest(
        normalized,
        readFileSync(path.resolve(privateKeyPath), "utf8"),
        { allowedImagePrefix },
      );
      writeFileSync(path.resolve(signatureOutputPath), `${signature}\n`, { encoding: "utf8", mode: 0o600 });
    }
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
