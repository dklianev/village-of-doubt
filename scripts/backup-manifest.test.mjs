import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const helper = path.resolve("scripts/backup-manifest.mjs");

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-backup-manifest-"));
  const artifact = path.join(directory, "werewolf_2026-08-12_12-00-00.sql.gz.age");
  const privateKey = path.join(directory, "backup-signing.key");
  const publicKey = path.join(directory, "backup-signing.pub");
  const keys = generateKeyPairSync("ed25519");
  writeFileSync(artifact, "encrypted-backup-payload");
  writeFileSync(privateKey, keys.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(publicKey, keys.publicKey.export({ type: "spki", format: "pem" }));
  return { artifact, privateKey, publicKey };
}

function run(args) {
  return spawnSync(process.execPath, [helper, ...args], { encoding: "utf8" });
}

test("creates and verifies a signed backup manifest", () => {
  const fixture = createFixture();
  const created = run([
    "create",
    fixture.artifact,
    fixture.privateKey,
    "werewolf",
    "release-42",
    "0008_steady_edwin_jarvis",
  ]);
  assert.equal(created.status, 0, created.stderr);

  const verified = run([
    "verify",
    fixture.artifact,
    fixture.publicKey,
    "werewolf",
    "8",
    "300",
  ]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.deepEqual(JSON.parse(verified.stdout), {
    artifact: path.basename(fixture.artifact),
    createdAt: JSON.parse(readFileSync(`${fixture.artifact}.manifest.json`, "utf8")).createdAt,
    database: "werewolf",
    migrationHead: "0008_steady_edwin_jarvis",
    releaseVersion: "release-42",
    schemaVersion: 1,
    sha256: JSON.parse(readFileSync(`${fixture.artifact}.manifest.json`, "utf8")).sha256,
    sizeBytes: 24,
  });
});

test("rejects a replaced backup even when its legacy checksum can be rewritten", () => {
  const fixture = createFixture();
  assert.equal(run(["create", fixture.artifact, fixture.privateKey, "werewolf", "release-42", "0008"]).status, 0);
  writeFileSync(fixture.artifact, "attacker-controlled-ciphertext");
  writeFileSync(`${fixture.artifact}.sha256`, "attacker-controlled-checksum\n");

  const verified = run(["verify", fixture.artifact, fixture.publicKey, "werewolf", "8", "300"]);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /(size|hash) does not match/i);
});

test("rejects a modified manifest without the producer private key", () => {
  const fixture = createFixture();
  assert.equal(run(["create", fixture.artifact, fixture.privateKey, "werewolf", "release-42", "0008"]).status, 0);
  const manifestPath = `${fixture.artifact}.manifest.json`;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);

  const verified = run(["verify", fixture.artifact, fixture.publicKey, "werewolf", "8", "300"]);
  assert.notEqual(verified.status, 0);
  assert.match(verified.stderr, /signature is invalid/i);
});

test("rejects placeholder release and migration provenance", () => {
  const fixture = createFixture();

  for (const [release, migration] of [
    ["unavailable", "0008_steady_edwin_jarvis"],
    ["release-42", "unknown"],
  ]) {
    const created = run([
      "create",
      fixture.artifact,
      fixture.privateKey,
      "werewolf",
      release,
      migration,
    ]);
    assert.notEqual(created.status, 0);
    assert.match(created.stderr, /provenance/i);
  }
});
