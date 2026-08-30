# Production runbook

## Release model

Production runs immutable images referenced by digest in a reviewed `release.json`.
Never build application images on the production host.

1. Run `pnpm verify:heavy` against the candidate commit.
2. Tag the commit. The release workflow builds signed-provenance images and uploads
   the Ed25519-signed `release.json` plus `release.json.sig`.
3. Copy the manifest to the host and use the absolute candidate path plus the
   immutable-checkout deploy command documented below.
4. Confirm public HTTPS `/api/health/ready`, public game `/health/ready`, the
   allowed-origin WSS upgrade through Caddy, and one real create-to-play flow.
5. Keep the previous two release manifests on the host.

An image rollback is safe only while all applied database migrations remain
backward-compatible with the previous image. Migrations use expand/contract:

1. Expand the schema without removing old columns or constraints.
2. Deploy code that understands both shapes and backfill data.
3. Remove the old shape in a later release after the rollback window closes.

For an approved destructive migration, stop traffic, create and verify a backup,
record the maintenance approval, and restore into a new database before switching
the connection string. Do not overwrite the live database in place.

The host serializes deploy, rollback, restore, and restore acceptance through
`/var/lib/werewolf/release-state/operations.lock`. A second operation fails
closed and prints the first owner's PID and start time. Never remove a retained
lock until that PID and the database/release state have been investigated.

Deploy writes a signed `migration-pending.json` before starting the migrator and
advances signed `schema-current.json` only after the bounded migrator succeeds.
A pending marker or a migration-head mismatch blocks automatic image rollback
with `MAINTENANCE REQUIRED`; do not delete these markers to force a rollback.
Failed deploys and rollbacks preserve mode-`0600` Compose diagnostics under
`release-state/forensics/`.

## Required external setup

- Public DNS for `PUBLIC_WEB_DOMAIN` and `PUBLIC_WS_DOMAIN` must resolve to the
  Caddy host. TCP 80/443 and UDP 443 must reach it, and Caddy must obtain valid
  public certificates. The deploy gate does not accept HTTP, private origins,
  redirects, or direct container-only health.
- Register both Google and Discord OAuth applications and their production
  callback URLs. Both provider controls are rendered, so all four client ID and
  secret variables are required by `check-production-env.mjs`.
- Configure Resend and a valid `REPORTS_NOTIFY_EMAIL`; a production release is
  rejected when player reports have no delivery destination.
- Provision server and browser Sentry DSNs, the release-manifest public key,
  the age backup recipient, and the two off-site rclone profiles before deploy.
- Keep the age private identity and backup-signing public key on a separate
  recovery host. The backup signing private key remains only on production.

## Backups

The systemd timer runs every six hours. The backup script creates a compressed
logical dump, encrypts it with the configured public age recipient, writes a
SHA-256 checksum and signed manifest, keeps 14 days locally, and uploads the
artifact set to the explicit non-root prefix in `RCLONE_REMOTE`. Before it
contacts Docker, it deletes only matching database-backup objects older than
`RCLONE_BACKUP_RETENTION_DAYS`, which must be from 1 through 30. Failure to list
or delete that scoped prefix fails the service before a new dump is made.

The same run exports `original_user_id` and `anonymous_user_id` from
`deleted_user_identities` into `werewolf_deletion_ledger.tsv.age`. It does not
export names, email addresses, account data, or game content. The ledger is
age-encrypted, checksummed, signed, and uploaded under the distinct rclone
profile and non-root prefix in `RCLONE_DELETION_LEDGER_REMOTE`. The script never
deletes from that destination. Keep the matching private age identity off-host.

The external ledger follows the six-hour backup schedule. Therefore its
explicit residual RPO is six hours: a deletion completed after the last
successful ledger upload can be absent after immediate total loss. Do not
describe this as synchronous deletion journaling, and investigate every failed
backup service run before relying on a recovery point.

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
sudo install -o root -g root -m 0755 "$release_source/scripts/backup-manifest.mjs" /usr/local/libexec/werewolf/backup-manifest.mjs
sudo install -o root -g root -m 0755 "$release_source/scripts/release-manifest.mjs" /usr/local/libexec/werewolf/release-manifest.mjs
sudo install -o root -g root -m 0755 "$release_source/scripts/check-backup-freshness.sh" /usr/local/libexec/werewolf/check-backup-freshness.sh
sudo install -d -o root -g root -m 0750 /etc/werewolf
if ! sudo test -e /etc/werewolf/backup.env; then
  sudo install -o root -g root -m 0600 "$release_source/ops/systemd/werewolf-backup.env.example" /etc/werewolf/backup.env
fi
if ! sudo test -e /etc/werewolf/backup-signing.key; then
  sudo openssl genpkey -algorithm ED25519 -out /etc/werewolf/backup-signing.key
  sudo openssl pkey -in /etc/werewolf/backup-signing.key -pubout -out /etc/werewolf/backup-signing.pub
  sudo chown root:root /etc/werewolf/backup-signing.key /etc/werewolf/backup-signing.pub
  sudo chmod 0600 /etc/werewolf/backup-signing.key
  sudo chmod 0644 /etc/werewolf/backup-signing.pub
fi
sudo install -o root -g root -m 0644 "$release_source/ops/systemd/werewolf-backup.service" /etc/systemd/system/
sudo install -o root -g root -m 0644 "$release_source/ops/systemd/werewolf-backup.timer" /etc/systemd/system/
sudo install -d -o root -g root -m 0700 /var/backups/werewolf
sudoedit /etc/werewolf/backup.env
sudo systemctl daemon-reload
sudo systemctl enable werewolf-backup.timer
if sudo test -s /var/lib/werewolf/release-state/current.json; then
  sudo systemctl start werewolf-backup.service
  sudo systemctl start werewolf-backup.timer
  sudo systemctl status werewolf-backup.service
  sudo systemctl list-timers werewolf-backup.timer
fi
```

`BACKUP_COMPOSE_PROJECT` in `/etc/werewolf/backup.env` must match the project shown
by `docker compose ls`. `BACKUP_AGE_RECIPIENT` must contain the public recipient
for an identity kept on a separate recovery host. The file stays owned by
root:root and mode `0600`. `BACKUP_RELEASE_ALLOWED_IMAGE_PREFIX` must match the
reviewed GHCR repository prefix. The timer verifies the signed active manifest
under `/var/lib/werewolf/release-state/current.json` and derives both the release
commit and migration head from it; never copy those values manually into
`backup.env`. Production off-site protection requires all of these values:

```sh
RCLONE_REMOTE=backup-store:werewolf/backups
RCLONE_DELETION_LEDGER_REMOTE=deletion-ledger:werewolf/deletion-ledger
RCLONE_BACKUP_RETENTION_DAYS=30
RCLONE_CONFIG=/etc/werewolf/rclone.conf
```

Both destinations must be explicit non-root prefixes without a trailing slash.
The script rejects equal rclone profile names so backup-retention deletion can
never address the ledger profile. Install `/etc/werewolf/rclone.conf` as
root:root with mode `0600`.

Use separate private Hetzner Object Storage buckets and credentials for the two
profiles. Keep versioning disabled on the database-backup bucket: otherwise a
30-day expiry or rclone deletion can leave noncurrent object versions behind.
Apply a lifecycle rule scoped only to the database-backup prefix and verify the
stored policy:

```sh
cat >/root/werewolf-backup-lifecycle.json <<'JSON'
{
  "Rules": [{
    "ID": "werewolf-backups-30-days",
    "Status": "Enabled",
    "Prefix": "werewolf/backups/",
    "Expiration": { "Days": 30 },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  }]
}
JSON
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api put-bucket-lifecycle-configuration \
  --bucket "$HETZNER_BACKUP_BUCKET" \
  --lifecycle-configuration file:///root/werewolf-backup-lifecycle.json
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api get-bucket-lifecycle-configuration \
  --bucket "$HETZNER_BACKUP_BUCKET"
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api get-bucket-versioning \
  --bucket "$HETZNER_BACKUP_BUCKET"
```

The last command must not report `Status: Enabled`. Hetzner lifecycle expiry is
the host-independent 30-day upper bound; the script's scoped `rclone delete` is
a second enforcement path and makes failures visible to systemd.

Enable versioning on the separate deletion-ledger bucket and mark the bucket as
protected in the Hetzner Console. Hetzner access keys have read/write access to
all buckets in their project by default, so distinct rclone profile names are
not an authorization boundary. Use a dedicated access key plus a bucket policy
scoped to the ledger prefix. Allow only the list, read, version-read, and write
operations the backup needs; explicitly deny `s3:DeleteObject` and
`s3:DeleteObjectVersion` to that principal and do not grant policy-management
actions. A separate Hetzner project is the fallback when that policy cannot be
enforced. Verify the deny against disposable keys in a staging bucket; never
test deletion against production ledger objects.

The four stable ledger objects are overwritten with the signature last;
versioning preserves a prior complete set if an upload is interrupted. Expire
only redundant noncurrent versions after 30 days. The lifecycle must not include
`Expiration`, because the latest cumulative ledger must remain available:

```sh
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api put-bucket-versioning \
  --bucket "$HETZNER_LEDGER_BUCKET" \
  --versioning-configuration Status=Enabled
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api get-bucket-versioning \
  --bucket "$HETZNER_LEDGER_BUCKET"

cat >/root/werewolf-ledger-lifecycle.json <<'JSON'
{
  "Rules": [{
    "ID": "werewolf-ledger-noncurrent-30-days",
    "Status": "Enabled",
    "Prefix": "werewolf/deletion-ledger/",
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  }]
}
JSON
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api put-bucket-lifecycle-configuration \
  --bucket "$HETZNER_LEDGER_BUCKET" \
  --lifecycle-configuration file:///root/werewolf-ledger-lifecycle.json
aws --endpoint-url "$HETZNER_S3_ENDPOINT" s3api get-bucket-lifecycle-configuration \
  --bucket "$HETZNER_LEDGER_BUCKET"
```

If the current quartet does not verify after an interrupted upload, recover the
newest mutually matching artifact and sidecar versions from version history and
record all four version IDs. Never disable signature verification to work around
a partial upload.

Before enabling the timer, exercise the exact deletion scope without Docker or
a database dump:

```sh
sudo sh -c '
  set -a
  . /etc/werewolf/backup.env
  set +a
  exec /usr/local/libexec/werewolf/backup-postgres.sh --retention-dry-run
'
```

Review the rclone output and confirm that every candidate is below only
`RCLONE_REMOTE`; the command must not mention the ledger destination. Then run
the normal service once and verify all database and ledger artifact sidecars.

The Ed25519 key under `/etc/werewolf/backup-signing.key` is the producer identity
for backup manifests. It must remain root-only and must never be copied to the
off-site backup store or recovery host. Copy only
`/etc/werewolf/backup-signing.pub` to recovery hosts. A restore verifies the
signed artifact name, SHA-256 digest, size, database, release metadata, and
creation time before age decryption; a checksum alone is not trusted.

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

`COMPOSE_WAIT_TIMEOUT_SECONDS` bounds dependency startup. The migrator also has
independent PostgreSQL lock, statement, and idle-transaction timeouts plus a
host process timeout (`MIGRATION_*_TIMEOUT_*`). The process timeout must be
larger than the server-side limits. Treat a process timeout as unresolved:
preserve `migration-pending.json`, enter maintenance, and inspect PostgreSQL
before any rollback decision.

The first deployment may use `SKIP_DEPLOY_BACKUP=1` only when PostgreSQL is new
and contains no user data. Every later deployment requires a healthy signed
`current.json`; missing or invalid provenance makes the pre-deploy backup fail
closed. Immediately after that first healthy deployment, run
`sudo systemctl start werewolf-backup.service` and
`sudo systemctl start werewolf-backup.timer`, then verify the signed backup.

Run the deploy from the immutable release checkout with the group-readable
manifest and external state directory:

```sh
sudo -u "$deploy_user" -H env \
  RELEASE_STATE_DIR=/var/lib/werewolf/release-state \
  sh -c 'cd "$1" && exec scripts/deploy-release.sh "$2"' \
  sh "$release_source" /var/lib/werewolf/releases/candidate.json
```

Run a restore drill at least monthly:

1. Download the selected off-site dump, checksum, signed manifest, and signature
   on a non-production host. Separately download the latest versions of
   `werewolf_deletion_ledger.tsv.age` and its `.sha256`, `.manifest.json`, and
   `.manifest.json.sig` sidecars from the protected ledger bucket. Do not use a
   ledger version chosen merely because it matches an old dump.
2. Copy the trusted backup signing public key to that host. Keep the age identity
   off production; the restore verifies both signed artifacts before decryption.
3. Run `scripts/restore-postgres.sh` from the active immutable checkout with
   `RESTORE_CONFIRM_DATABASE`, `BACKUP_SIGNING_PUBLIC_KEY_FILE`, and the
   off-host age identity. Set `RESTORE_DELETION_LEDGER_FILE` to the downloaded
   `werewolf_deletion_ledger.tsv.age`. By default it verifies signed
   `release-state/current.json`, pulls that manifest's digest-pinned migrator,
   web, and game images, then restores and migrates a staging database before
   stopping writers. If release state was recovered separately, pass the
   reviewed pair with `RESTORE_RELEASE_MANIFEST` and
   `RESTORE_RELEASE_MANIFEST_SIGNATURE`; never substitute image tags manually.
4. After cutover, require the built-in account/history integrity, runtime-role,
   migration, and deletion-tombstone checks. A live restore also requires deep
   web/game readiness plus public HTTPS and WSS through a freshly recreated
   Caddy container. Any failure automatically returns the original database
   and keeps writers stopped.
5. Confirm a real sign-in/account view, history view, and create-to-play flow.
   The original database remains as `<database>_restore_rollback_<run-id>`.
6. Only after explicit product and operator acceptance, run the exact
   `RESTORE_ACCEPT_DATABASE` and `RESTORE_ACCEPT_ROLLBACK_DATABASE` command
   printed by the restore (`sh scripts/restore-accept.sh ...`). The acceptance script repeats semantic and
   ingress checks and validates signed applied-schema provenance before deleting
   that one rollback database.
7. Record the backup timestamp, restore duration, rollback database name,
   acceptance time, and result. Preserve the restore record under
   `release-state/forensics/`.

Signed restores fail before Docker unless the external deletion ledger and all
verification material are present. The ledger's signed creation time must be at
least as recent as the selected backup. After writers stop, the restore merges
that external ledger with any tombstones still available in the current
database, reapplies account deletion to the staged copy, and verifies after
cutover that neither the identities nor their historical references were
reintroduced. A total-loss replacement database may have no current tombstone
table; the verified external ledger remains mandatory and sufficient for the
known exported deletions. `RESTORE_ONLY=1` still runs database semantics but
leaves writers stopped and cannot claim application readiness.

The timestamp comparison prevents an older ledger from accompanying a newer
backup, but it cannot prove that an operator downloaded the newest ledger
version. Always fetch the current stable objects from the protected bucket and
record their version IDs in the restore evidence. The six-hour ledger RPO
remains the explicit limit for deletions completed after the last successful
upload.

Only after all selected restore gates pass does the script copy the verified
active manifest to signed `schema-current.json` and clear an old
`migration-pending.json`. A failed restore leaves both pieces of schema evidence
unchanged. This lets a rehearsed restore resolve an interrupted migration
without claiming that a merely attempted cutover repaired provenance.

Target recovery objectives for the initial beta are RPO 6 hours and RTO 60 minutes.

## Incident response

### Web unavailable

1. Check `docker compose ps` and `docker compose logs --tail 200 web caddy`.
2. Check web readiness, then game and Redis readiness.
3. If the candidate image is unhealthy and the schema is compatible, deploy the
   previous release manifest. The rollback script permits this only when its
   migration head exactly matches signed `schema-current.json` and no migration
   is pending.
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

Keep the beta web service at one replica while Next.js Cache Components use the
default in-memory cache. Before adding a second web replica, configure a shared Next.js `cacheHandler`,
set `cacheMaxMemorySize: 0`, and prove cross-replica
`cacheTag`/`updateTag` invalidation in an integration test. Redis-backed rate
limits and sessions are already shared, but they do not make the Next.js route
cache distributed automatically.
