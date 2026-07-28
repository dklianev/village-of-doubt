# Production database migration policy

Production migrations use expand/contract so the previous application image can
run against the new schema during the rollback window.

## Normal release

Allowed examples:

- add a nullable column;
- add a table or non-conflicting index;
- backfill data without removing the old representation;
- deploy code that can read both old and new representations.

Removal happens in a later release, after the previous image is outside the
rollback window and a restore rehearsal has passed.

Run:

```bash
pnpm check:migrations
pnpm test:migrations
```

The policy guard evaluates migrations after the checked-in baseline and rejects
drop, rename, truncate, type changes, `SET NOT NULL`, and deletes.

## Maintenance exception

A destructive migration is not a routine deploy. It requires an entry in
`packages/database/drizzle/migration-policy.json` with:

- `mode: "maintenance"`;
- `backupRequired: true`;
- a concrete reason;
- a rehearsed restore plan.

Schedule a write outage, take and verify a backup, preserve the failed database,
and restore into a new instance if rollback is required. Never improvise a down
migration against the only production database.
