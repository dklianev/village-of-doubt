# Production runbook

## Release model

Production runs immutable images referenced by digest in a reviewed `release.json`.
Never build application images on the production host.

1. Run `pnpm verify:heavy` against the candidate commit.
2. Tag the commit. The release workflow builds signed-provenance images and uploads
   the Ed25519-signed `release.json` plus `release.json.sig`.
3. Copy the manifest to the host and use the absolute candidate path plus the
   immutable-checkout deploy command documented below.
4. Confirm `/api/health/ready`, the game `/health/ready`, and one real create-to-play flow.
5. Keep the previous two release manifests on the host.

An image rollback is safe only while all applied database migrations remain
backward-compatible with the previous image. Migrations use expand/contract:

1. Expand the schema without removing old columns or constraints.
2. Deploy code that understands both shapes and backfill data.
3. Remove the old shape in a later release after the rollback window closes.

For an approved destructive migration, stop traffic, create and verify a backup,
record the maintenance approval, and restore into a new database before switching
the connection string. Do not overwrite the live database in place.

## Backups

The systemd timer runs every six hours. The backup script creates a compressed
logical dump, encrypts it with the configured public age recipient, writes a
SHA-256 checksum for the encrypted artifact, keeps 14 days locally, and copies
both files to `RCLONE_REMOTE`. Keep the matching private age identity off-host.

The scheduled backup is the only service in this path that talks to the Docker
daemon. It runs a root-owned, fixed helper and reads a dedicated root-only
environment file. The application account (`werewolf`) must not belong to the
Docker group; use a separate deployment identity or root-controlled CI for
release operations.

Perform the one-time privilege split from a root console or a different
administrative account, not from a `werewolf` session:

```sh
if id -nG werewolf | tr ' ' '\n' | grep -qx docker; then
  sudo gpasswd -d werewolf docker
fi
sudo loginctl terminate-user werewolf
sudo reboot
```

The reboot is required because already-running shells and services retain their
old supplementary group IDs. After reconnecting, `docker info` as `werewolf`
must fail:

```sh
if sudo -u werewolf -H docker info >/dev/null 2>&1; then
  echo "werewolf still has Docker daemon access" >&2
  exit 1
fi
```

Download `release.json` and `release.json.sig` directly from the trusted GitHub
Actions release artifact. Install the Ed25519 public key as
`/etc/werewolf/release-manifest.pub` (root-owned, mode `0644`) and set
`RELEASE_ALLOWED_IMAGE_PREFIX=ghcr.io/dklianev/village-of-doubt` in the
production environment. Never run root Git commands in a checkout that was writable by the
application account. Create a new root-owned checkout for the exact manifest
commit with system and global Git configuration disabled:

```sh
set -eu
deploy_user=werewolf-deploy
deploy_group="$(id -gn "$deploy_user")"
sudo install -d -o root -g "$deploy_group" -m 0750 /var/lib/werewolf/releases
sudo install -o root -g "$deploy_group" -m 0640 release.json /var/lib/werewolf/releases/candidate.json
sudo install -o root -g "$deploy_group" -m 0640 release.json.sig /var/lib/werewolf/releases/candidate.json.sig
expected_source="$(
  sudo node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).sourceCommit; if(!/^[a-f0-9]{40}$/i.test(value)) throw new Error("invalid sourceCommit"); process.stdout.write(value.toLowerCase())' \
    /var/lib/werewolf/releases/candidate.json
)"
release_source="/srv/werewolf-releases/$expected_source"
sudo install -d -o root -g root -m 0755 /srv/werewolf-releases
if sudo test -e "$release_source"; then
  echo "Release checkout already exists: $release_source" >&2
  exit 1
fi
trusted_git() {
  sudo env -i \
    HOME=/root \
    PATH=/usr/bin:/bin \
    GIT_CONFIG_NOSYSTEM=1 \
    GIT_CONFIG_GLOBAL=/dev/null \
    GIT_TERMINAL_PROMPT=0 \
    git "$@"
}
trusted_git init "$release_source"
trusted_git -C "$release_source" remote add origin https://github.com/dklianev/village-of-doubt.git
trusted_git -C "$release_source" fetch --depth=1 origin "$expected_source"
trusted_git -C "$release_source" -c core.hooksPath=/dev/null checkout --detach FETCH_HEAD
actual_source="$(trusted_git -C "$release_source" rev-parse HEAD)"
if [ "$actual_source" != "$expected_source" ]; then
  echo "Release checkout does not match manifest sourceCommit." >&2
  exit 1
fi
sudo ln -s /etc/werewolf/production.env "$release_source/.env"
sudo chown -h root:root "$release_source/.env"
sudo chmod -R a-w "$release_source"
sudo chown root:"$deploy_group" /etc/werewolf/production.env
sudo chmod 0640 /etc/werewolf/production.env
sudo install -d -o "$deploy_user" -g "$deploy_group" -m 0700 /var/lib/werewolf/release-state
```

Install the verified helpers and units:

```sh
sudo install -d -o root -g root -m 0755 /usr/local/libexec/werewolf
sudo install -o root -g root -m 0755 "$release_source/scripts/backup-postgres.sh" /usr/local/libexec/werewolf/backup-postgres.sh
sudo install -o root -g root -m 0755 "$release_source/scripts/check-backup-freshness.sh" /usr/local/libexec/werewolf/check-backup-freshness.sh
sudo install -d -o root -g root -m 0750 /etc/werewolf
if ! sudo test -e /etc/werewolf/backup.env; then
  sudo install -o root -g root -m 0600 "$release_source/ops/systemd/werewolf-backup.env.example" /etc/werewolf/backup.env
fi
sudo install -o root -g root -m 0644 "$release_source/ops/systemd/werewolf-backup.service" /etc/systemd/system/
sudo install -o root -g root -m 0644 "$release_source/ops/systemd/werewolf-backup.timer" /etc/systemd/system/
sudo install -d -o root -g root -m 0700 /var/backups/werewolf
sudoedit /etc/werewolf/backup.env
sudo systemctl daemon-reload
sudo systemctl enable --now werewolf-backup.timer
sudo systemctl start werewolf-backup.service
sudo systemctl status werewolf-backup.service
sudo systemctl list-timers werewolf-backup.timer
```

`BACKUP_COMPOSE_PROJECT` in `/etc/werewolf/backup.env` must match the project shown
by `docker compose ls`. `BACKUP_AGE_RECIPIENT` must contain the public recipient
for an identity kept on a separate recovery host. The file stays owned by
root:root and mode `0600`. If
`RCLONE_REMOTE` is enabled, install its configuration at
`/etc/werewolf/rclone.conf`, owned by root:root and mode `0600`, and keep
`RCLONE_CONFIG=/etc/werewolf/rclone.conf` in the backup environment.

After each release that changes either helper, reinstall the root-owned copies
from that release's clean checkout before restarting the timer. The conditional
bootstrap above preserves the live `/etc/werewolf/backup.env`; helper upgrades
must never replace its off-site configuration.

`scripts/deploy-release.sh` starts and waits for `werewolf-backup.service` before
pulling or migrating a candidate release. A non-root deployment identity needs a
narrow passwordless sudo rule only for
`/usr/bin/systemctl start werewolf-backup.service`; do not give the application
identity this rule. The deployment identity also needs Docker daemon access,
which is root-equivalent; keep it separate from `werewolf`, interactive users,
and the web/game services.

Run the deploy from the immutable release checkout with the group-readable
manifest and external state directory:

```sh
sudo -u "$deploy_user" -H env \
  RELEASE_STATE_DIR=/var/lib/werewolf/release-state \
  sh -c 'cd "$1" && exec scripts/deploy-release.sh "$2"' \
  sh "$release_source" /var/lib/werewolf/releases/candidate.json
```

Run a restore drill at least monthly:

1. Download the latest off-site dump and checksum on a non-production host.
2. Verify the checksum and gzip stream.
3. Restore into an empty staging database with `scripts/restore-postgres.sh`.
4. Run migrations, smoke tests, and a representative account/history query.
5. Record the backup timestamp, restore duration, and result.

Target recovery objectives for the initial beta are RPO 6 hours and RTO 60 minutes.

## Incident response

### Web unavailable

1. Check `docker compose ps` and `docker compose logs --tail 200 web caddy`.
2. Check web readiness, then game and Redis readiness.
3. If the candidate image is unhealthy and the schema is compatible, deploy the
   previous release manifest.
4. If both releases fail, preserve logs and inspect database/Redis dependencies.

### Redis unavailable

Redis is a fail-closed dependency for production rate limits and distributed room
guards. New joins and token issuance may stop while existing room processes remain
alive.

1. Check Redis health, memory, persistence, and authentication failures.
2. Do not bypass Redis with an in-memory fallback in production.
3. Restart Redis only after preserving its logs and AOF state.
4. Confirm web and game readiness before reopening traffic.

### Game server unavailable

A process restart currently terminates active rooms because room snapshots are not
durable. Treat a restart as a user-visible incident.

1. Drain the game process before a planned deploy.
2. For an unplanned crash, preserve logs and Sentry event IDs before restarting.
3. Confirm token issuance, WebSocket ingress, and one six-player start flow.
4. Notify active hosts that interrupted rooms cannot be resumed in the initial beta.

### PostgreSQL unavailable or corrupted

1. Stop web and game writes.
2. Preserve the database volume and logs.
3. Restore the latest verified backup into a new database.
4. Run migrations and smoke tests against the new database.
5. Update `MIGRATION_DATABASE_URL`, `WEB_DATABASE_URL`, and `GAME_DATABASE_URL`
   to the restored database while preserving their separate identities.
6. Redeploy the same immutable release and verify both readiness endpoints.

Detailed role, pool, maintenance, and query-observability procedures live in
`docs/operations/database-operations.md`.

## Capacity triggers

The measured launch target is 200 concurrent clients. Investigate before scaling
past 300 clients per game process or when any of these persist for five minutes:

- join p95 exceeds 3 seconds;
- event-loop utilization exceeds 80%;
- game RSS exceeds 80% of its container limit;
- PostgreSQL active connections exceed 80% of `max_connections`;
- Redis memory exceeds 80% of `maxmemory`;
- readiness failures or reconnect rates rise above the normal baseline.

Scale the game service horizontally only with shared Redis presence/driver enabled.
Active rooms are not migrated between processes.
