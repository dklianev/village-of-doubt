import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("database backups are scheduled, verified, retained, and copied off-site", () => {
  const service = read("ops/systemd/werewolf-backup.service");
  const timer = read("ops/systemd/werewolf-backup.timer");
  const backup = read("scripts/backup-postgres.sh");
  const freshness = read("scripts/check-backup-freshness.sh");

  assert.equal((timer.match(/^OnCalendar=/gm) ?? []).length, 4);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /^RandomizedDelaySec=5min$/m);
  assert.match(service, /^ExecStart=\/bin\/sh .*backup-postgres\.sh$/m);
  assert.match(service, /^ExecStartPost=\/bin\/sh .*check-backup-freshness\.sh$/m);
  assert.match(service, /^ReadWritePaths=\/var\/backups\/werewolf$/m);
  assert.match(backup, /gzip -t/);
  assert.match(backup, /sha256sum/);
  assert.match(backup, /RCLONE_REMOTE/);
  assert.match(freshness, /BACKUP_MAX_AGE_HOURS/);
  assert.match(freshness, /gzip -t/);
  assert.match(freshness, /sha256sum -c/);
});

test("runbook documents immutable rollback, restore drills, and recovery objectives", () => {
  const runbook = read("docs/operations/production-runbook.md");

  assert.match(runbook, /immutable images/i);
  assert.match(runbook, /expand\/contract/i);
  assert.match(runbook, /restore drill at least monthly/i);
  assert.match(runbook, /RPO 6 hours and RTO 60 minutes/i);
  assert.match(runbook, /200 concurrent clients/i);
  assert.match(runbook, /Active rooms are not migrated/i);
});

test("Lighthouse uses Playwright headless shell on Windows when available", () => {
  const lighthouse = read("scripts/lighthouse.mjs");

  assert.match(lighthouse, /process\.env\.CHROME_PATH \?\? findPlaywrightHeadlessShell\(\)/);
  assert.match(lighthouse, /process\.platform !== "win32"/);
  assert.match(lighthouse, /chromium_headless_shell-/);
  assert.match(lighthouse, /chrome-headless-shell\.exe/);
});
