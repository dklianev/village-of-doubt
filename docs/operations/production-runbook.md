# Production runbook

## Release model

Production runs immutable images referenced by digest in a reviewed `release.json`.
Never build application images on the production host.

1. Run `pnpm verify:heavy` against the candidate commit.
2. Tag the commit. The release workflow builds signed-provenance images and uploads `release.json`.
3. Copy the manifest to the host and run `scripts/deploy-release.sh release.json`.
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
logical dump, verifies gzip integrity, writes a SHA-256 checksum, keeps 14 days
locally, and copies both files to `RCLONE_REMOTE`.

Install the units:

```sh
sudo install -o root -g root -m 0644 ops/systemd/werewolf-backup.service /etc/systemd/system/
sudo install -o root -g root -m 0644 ops/systemd/werewolf-backup.timer /etc/systemd/system/
sudo install -d -o werewolf -g werewolf -m 0750 /var/backups/werewolf
sudo systemctl daemon-reload
sudo systemctl enable --now werewolf-backup.timer
sudo systemctl start werewolf-backup.service
sudo systemctl status werewolf-backup.service
sudo systemctl list-timers werewolf-backup.timer
```

`/etc/werewolf/production.env` must contain the production Compose variables and
`RCLONE_REMOTE`. The `werewolf` user needs read access to that file and membership
in the Docker group.

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
5. Switch `DATABASE_URL`, redeploy the same immutable release, and verify readiness.

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
