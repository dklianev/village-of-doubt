# Database operations

## Runtime model

Production uses three PostgreSQL identities:

- `werewolf_migrator` owns the database, schemas, migrations, tables, and types.
- `werewolf_web` serves authentication, accounts, history, leaderboard, and maintenance.
- `werewolf_game` persists authoritative game snapshots and events.

`postgres-roles` reconciles these roles before every migration. Runtime roles
have DML access but no database or schema creation rights. Keep
`MIGRATION_DATABASE_URL`, `WEB_DATABASE_URL`, and `GAME_DATABASE_URL` distinct,
with different URL-encoded passwords.

The application remains on Drizzle and postgres-js. Adding Prisma would create a
second migration/query stack without solving a current production problem.

## Connection budget

The default pool is eight connections per application process. Estimate the
upper bound before scaling:

```text
connections = web replicas * web pool
            + game replicas * game pool
            + migration and operator reserve
```

With one web and one game replica, the normal ceiling is 16 application
connections. Reserve at least 20 connections for migration, readiness, backups,
and incident work.

Do not add PgBouncer for the initial single-host deployment. Add it in
transaction mode when one of these becomes true:

- five or more combined web/game replicas are planned;
- active connections remain above 60% of PostgreSQL `max_connections`;
- connection acquisition p95 exceeds 50 ms for five minutes;
- serverless or burst scaling makes process-local pools unstable.

postgres-js already uses `prepare: false`, which is compatible with transaction
pooling. After adding PgBouncer, keep each process pool between four and eight
and measure again rather than multiplying both pool layers.

## Timeouts and labels

Every connection has:

- a service-specific `application_name`;
- `statement_timeout=15s`;
- `lock_timeout=3s`;
- `idle_in_transaction_session_timeout=10s`;
- a finite connection lifetime.

Override the lock and idle transaction limits only after reviewing the slow
query and lock evidence. Do not disable them to hide a migration or query issue.

## Lifecycle maintenance

The web Node runtime starts one hourly maintenance loop per process. A
transaction-scoped PostgreSQL advisory lock ensures that only one replica runs
each pass.

Each pass is bounded and uses `FOR UPDATE SKIP LOCKED`:

- expired sessions are deleted;
- expired verification records are deleted;
- lobbies untouched for 48 hours become `abandoned`;
- active games are never abandoned by age alone; `games.updated_at` is not a room heartbeat;
- old events are deleted only when `DATABASE_EVENT_RETENTION_DAYS` is greater
  than zero and their game is already ended or abandoned.

Event retention is disabled by default. Enabling it is a product/data-retention
decision because it removes old replay detail. Start with a documented window,
take a verified backup, and monitor the first cleanup passes.

## OAuth token encryption and rotation

Better Auth encrypts every new OAuth access, refresh, and ID token before it is
stored. The startup maintenance pass converts legacy plaintext rows and
re-wraps bare hexadecimal ciphertext with the current versioned key in bounded
batches under a dedicated PostgreSQL advisory lock. Startup fails closed if the
legacy key has been removed while any unversioned token remains.

For routine secret rotation:

1. Set `BETTER_AUTH_SECRETS` to a newest-first key ring such as
   `2:<new-secret>,1:<previous-secret>`.
2. Keep `BETTER_AUTH_SECRET` set to the pre-versioning secret.
3. Deploy and confirm auth callbacks, account linking, and that maintenance
   reports zero unversioned tokens after all batches complete.
4. Verify the database directly:

   ```sql
   SELECT COUNT(*) AS unversioned_oauth_tokens
   FROM (
     SELECT "access_token" AS token FROM "account"
     UNION ALL SELECT "refresh_token" FROM "account"
     UNION ALL SELECT "id_token" FROM "account"
   ) AS oauth_tokens
   WHERE token IS NOT NULL AND token NOT LIKE '$ba$%';
   ```

5. Wait at least one maximum session lifetime so legacy signed cookies have
   expired, take a verified backup, then remove `BETTER_AUTH_SECRET` and set
   `BETTER_AUTH_LEGACY_TOKENS_RETIRED=true`.
6. Remove an old version from `BETTER_AUTH_SECRETS` only after its retention
   window and a database check confirm no matching `$ba$<version>$` envelopes
   remain.

The first entry is always the encryption key for new and migrated values.
Production validation rejects duplicate versions, weak values, and a key ring
whose highest version is not first. Never log token values or key-ring values.

## Query observability

PostgreSQL loads `pg_stat_statements`, records I/O timing, labels logs with
`application_name`, and logs statements slower than 500 ms by default. The
extension lives in the restricted `werewolf_observability` schema.

Run these queries with the administrative database identity:

```sql
SELECT
  queryid,
  calls,
  round(total_exec_time::numeric, 1) AS total_ms,
  round(mean_exec_time::numeric, 1) AS mean_ms,
  rows,
  left(query, 180) AS query
FROM werewolf_observability.pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;
```

```sql
SELECT application_name, state, count(*)::int
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY application_name, state
ORDER BY application_name, state;
```

Investigate a query when mean execution exceeds 150 ms, a single call exceeds
500 ms repeatedly, or shared block reads grow unexpectedly. Use
`EXPLAIN (ANALYZE, BUFFERS)` on a staging copy, never casually on a write query
in production.

## Aggregate tables

The public leaderboard currently aggregates `game_players` joined to ended
games and is cached server-side for 60 seconds. Keep this simple query until
measurement shows a problem.

Introduce an incrementally maintained statistics table only when:

- `game_players` exceeds roughly one million rows;
- leaderboard p95 remains above 150 ms after index and query review; or
- multiple reports repeatedly scan the same completed-game facts.

If that threshold is reached, update aggregate rows in the same persistence
transaction that finalizes a game, keep the source tables authoritative, and add
a reconciliation job that can rebuild aggregates from history.

## Migration and restore rules

- Generate and review SQL under `packages/database/drizzle/`.
- Apply only expand/contract migrations during a normal release.
- Keep schema and generated migration metadata in the same commit.
- Run `pnpm check:migrations` and `pnpm test:migrations` against PostgreSQL 17.
- Never use `db:push` in production.
- A restore must target a new database, run the real migrator, reconcile roles,
  and pass account/history and create-to-play smoke checks before cutover.
- The default restore path requires both `web` and `game` to be running so
  Compose can verify both health checks after cutover. `RESTORE_ONLY=1` is for
  an intentionally offline restore; it leaves writers stopped and preserves
  the rollback database until the operator completes those checks manually.

Migration `0008_steady_edwin_jarvis` is a pre-launch schema hardening migration.
Its five indexes are intentionally transactional and may take blocking locks.
Apply it before first production traffic or during a declared maintenance
window. For a future index on a large live table, measure on staging and use a
separate reviewed operational `CREATE INDEX CONCURRENTLY` procedure; do not put
`CONCURRENTLY` inside Drizzle's transactional migration stream.
