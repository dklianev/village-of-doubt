import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("database backups are scheduled, verified, retained, and copied off-site", () => {
  const service = read("ops/systemd/werewolf-backup.service");
  const timer = read("ops/systemd/werewolf-backup.timer");
  const backup = read("scripts/backup-postgres.sh");
  const freshness = read("scripts/check-backup-freshness.sh");
  const deploy = read("scripts/deploy-release.sh");
  const rollback = read("scripts/rollback-release.sh");
  const runbook = read("docs/operations/production-runbook.md");

  assert.equal((timer.match(/^OnCalendar=/gm) ?? []).length, 4);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /^RandomizedDelaySec=5min$/m);
  assert.doesNotMatch(service, /^User=werewolf$/m);
  assert.doesNotMatch(service, /^Group=werewolf$/m);
  assert.doesNotMatch(service, /^SupplementaryGroups=.*docker.*$/m);
  assert.match(service, /^User=root$/m);
  assert.match(service, /^Group=root$/m);
  assert.match(service, /^EnvironmentFile=\/etc\/werewolf\/backup\.env$/m);
  assert.match(service, /^Environment=BACKUP_REQUIRE_FIXED_CONTAINER=1$/m);
  assert.match(service, /^ExecStart=\/usr\/local\/libexec\/werewolf\/backup-postgres\.sh$/m);
  assert.match(service, /^ExecStartPost=\/usr\/local\/libexec\/werewolf\/check-backup-freshness\.sh$/m);
  assert.match(service, /^ReadWritePaths=\/var\/backups\/werewolf$/m);
  assert.match(service, /^UMask=0077$/m);
  assert.match(backup, /BACKUP_COMPOSE_PROJECT/);
  assert.match(backup, /BACKUP_REQUIRE_FIXED_CONTAINER/);
  assert.match(backup, /"\$docker_command" ps/);
  assert.match(backup, /"\$docker_command" exec/);
  assert.match(backup, /gzip -t/);
  assert.match(backup, /sha256sum/);
  assert.match(backup, /RCLONE_REMOTE/);
  assert.match(freshness, /BACKUP_MAX_AGE_HOURS/);
  assert.match(freshness, /BACKUP_CLOCK_SKEW_SECONDS/);
  assert.match(freshness, /gzip -t/);
  assert.match(freshness, /sha256sum -c/);
  assert.doesNotMatch(deploy, /^\s*scripts\/backup-postgres\.sh$/m);
  assert.match(deploy, /systemctl start "\$backup_service"/);
  assert.match(deploy, /RELEASE_STATE_DIR:-\/var\/lib\/werewolf\/release-state/);
  assert.match(rollback, /RELEASE_STATE_DIR:-\/var\/lib\/werewolf\/release-state/);
  assert.match(runbook, /must not belong to the\s+Docker group/i);
  assert.match(runbook, /\/usr\/local\/libexec\/werewolf\/backup-postgres\.sh/);
  assert.match(runbook, /\/etc\/werewolf\/backup\.env/);
  assert.match(runbook, /root:root and mode `0600`/i);
  assert.match(runbook, /loginctl terminate-user werewolf/);
  assert.match(runbook, /reboot/);
  assert.match(runbook, /docker info[\s\S]*must fail/i);
  assert.match(runbook, /\/srv\/werewolf-releases\/\$expected_source/);
  assert.match(runbook, /GIT_CONFIG_NOSYSTEM=1/);
  assert.match(runbook, /GIT_CONFIG_GLOBAL=\/dev\/null/);
  assert.match(runbook, /```sh\s+set -eu/);
  assert.match(runbook, /if sudo test -e "\$release_source"; then[\s\S]*exit 1[\s\S]*fi/);
  assert.match(runbook, /if \[ "\$actual_source" != "\$expected_source" \]; then[\s\S]*exit 1[\s\S]*fi/);
  assert.match(runbook, /if ! sudo test -e \/etc\/werewolf\/backup\.env/);
  assert.match(runbook, /RELEASE_STATE_DIR=\/var\/lib\/werewolf\/release-state/);
  assert.match(runbook, /\/var\/lib\/werewolf\/releases\/candidate\.json/);
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
