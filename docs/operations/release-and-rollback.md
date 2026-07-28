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
3. Run `scripts/deploy-release.sh release.json`.

The script validates immutable image references, drains active rooms, creates a
database backup, pulls images, runs the forward migration once, starts the
release without `--build`, and waits for web/game health checks. The current
manifest changes only after the release is healthy.

`SKIP_DEPLOY_DRAIN=1` and `SKIP_DEPLOY_BACKUP=1` exist only for isolated CI
environments. Do not use them for a live deployment.

## Application rollback

Run:

```bash
scripts/rollback-release.sh .release-state/previous.json
```

This rolls web and game back to their previous digests. It never runs an old
migrator and never attempts a database downgrade. This is safe only while every
production migration follows the expand/contract policy.

## Database rollback

Schema rollback is a recovery operation, not part of normal image rollback:

1. stop writes and drain active games;
2. preserve the failed database volume/snapshot for investigation;
3. restore the pre-release backup into a new database instance;
4. verify the restored schema and row counts;
5. point the previous application release at the restored database;
6. run smoke, auth, room creation, and history checks before reopening traffic.

Never run hand-written down migrations against the only production database.
