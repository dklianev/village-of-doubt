# Immutable release and rollback

Production releases are built in CI and deployed by digest. The production host
does not compile application code.

## Release artifact

Every release has a `release.json` with:

- the full Git commit SHA;
- the current Drizzle migration head;
- digest-pinned `web`, `game`, and `migrator` images;
- the creation timestamp.

Validate it before use:

```bash
node scripts/release-manifest.mjs release.json
```

## Deploy

1. Check out the same Git commit as `releaseVersion`. This supplies the matching
   Compose and operator scripts, not application binaries.
2. Load the normal production `.env` and Docker registry credentials.
3. Run `scripts/deploy-release.sh` with the absolute path to the trusted
   manifest and `RELEASE_STATE_DIR=/var/lib/werewolf/release-state`, as shown in
   the production runbook.

The script acquires the host operations lock, validates immutable image
references, drains active rooms, creates a database backup, pulls images, and
runs the forward migration once with PostgreSQL and host-process timeouts. It
starts the release without `--build` and requires web, game, and Caddy container
health plus public HTTPS readiness and an allowed-origin WSS upgrade. The
current manifest changes only after all gates pass.

Before migration it preserves the signed candidate as
`migration-pending.json`. After success it atomically advances
`schema-current.json`; an interrupted or failed migrator leaves the pending
evidence in place and blocks automatic rollback. Failed releases preserve
bounded Compose logs under `release-state/forensics/`.

`SKIP_DEPLOY_DRAIN=1` and `SKIP_DEPLOY_BACKUP=1` exist only for isolated CI
environments. Do not use them for a live deployment.

## Application rollback

Run:

```bash
deploy_user=werewolf-deploy
release_source="/srv/werewolf-releases/<full-source-commit>"
sudo -u "$deploy_user" -H env \
  RELEASE_STATE_DIR=/var/lib/werewolf/release-state \
  sh -c 'cd "$1" && exec scripts/rollback-release.sh "$2"' \
  sh "$release_source" /var/lib/werewolf/release-state/previous.json
```

This rolls web and game back to their previous digests. It never runs an old
migrator and never attempts a database downgrade. The script fails with a
maintenance message before changing images unless the signed target migration
head exactly matches signed `schema-current.json` and no migration is pending.
That conservative equality check is the only compatibility claim available in
the manifest; a different head requires the database recovery procedure even
when a developer expects an expand migration to be backward-compatible.

## Database rollback

Schema rollback is a recovery operation, not part of normal image rollback:

1. stop writes and drain active games;
2. preserve the failed database volume/snapshot for investigation;
3. restore the pre-release backup into a new database instance;
4. verify account/history integrity, runtime-role create privileges, applied
   migrations, and the required protected deletion ledger merged with any live
   tombstones after cutover;
5. point the previous application release at the restored database;
6. run smoke, auth, room creation, and history checks before reopening traffic.

Never run hand-written down migrations against the only production database.
The restore retains the original database until a separate
`sh scripts/restore-accept.sh` invocation rechecks internal and public readiness
and signed schema provenance, then receives exact live/rollback database
acceptance values.
It also verifies the signed active release manifest, pulls its digest-pinned
migrator and application images, and force-recreates web, game, and Caddy after
cutover. A successful restore records that manifest as the applied schema
provenance; a failed restore does not clear unresolved migration evidence.
