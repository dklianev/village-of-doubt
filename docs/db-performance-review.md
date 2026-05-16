# Pre-launch database performance review

This document records the pre-launch database audit, the indexes added in this PR, and the query path changed to remove the `/history` timeline N+1 pattern.

## Database performance observed structure

The database schema already has baseline indexes for auth ownership, game lookup, player lookup, events, and achievements. Foreign keys use two policies:

- personal-data ownership rows cascade when the user is deleted;
- game-history references do not cascade, because account deletion anonymizes game history first.

The app uses Drizzle with the postgres.js driver from `packages/database/src/client.ts`.

## Database performance issues found

### DB-PERF-001 - Missing index on `games.endedAt` (P1)

`getLeaderboardRows(limit = 500)` filters ended games and orders by `games.endedAt DESC`. The previous schema had `games_status_idx`, but no composite index covering status plus ended time.

Fix: add `games_status_ended_at_idx` on `(status, ended_at DESC)`.

### DB-PERF-002 - N+1 timeline queries in `getRecentGameHistory` consumer (P1)

`apps/web/app/history/page.tsx` loaded recent games and then executed one `getGameTimeline(db, game.id, 6)` query per ended game. At 20 games, that is 20 timeline round-trips.

Fix: add `getGameTimelinesBatch(db, gameIds, perGameLimit)` using `ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC)` and group rows by `gameId`.

### DB-PERF-003 - `getGameHistoryForUser` runs 3 sequential queries (P2)

This path is currently rare and only used on account/history surfaces. It remains deferred until usage metrics justify combining it into a single join/subquery.

### DB-PERF-004 - Missing indexes on `verification.identifier` and `verification.expiresAt` (P1)

Better Auth verification lookups need fast access by identifier. Expiry cleanup also benefits from an `expires_at` index.

Fix: add `verification_identifier_idx` and `verification_expires_at_idx`.

### DB-PERF-005 - Connection pool not explicitly configured (P2)

The previous postgres.js client used `max: 10` and did not set idle, connect, or statement timeouts.

Fix: set `max: 20`, `idle_timeout: 30`, `connect_timeout: 5`, and `statement_timeout: 15000`.

### DB-PERF-006 - Missing indexes on `gameEvents.actorId` and `gameEvents.targetId` (P3)

No current hot query filters events by actor or target. These indexes are deferred until analytics or per-user event lookup exists.

## Existing indexes

From `packages/database/src/schema.ts` before this PR:

| Table | Index | Columns |
| --- | --- | --- |
| `session` | `session_user_id_idx` | `user_id` |
| `account` | `account_user_id_idx` | `user_id` |
| `games` | `games_code_idx` | `code` |
| `games` | `games_host_id_idx` | `host_id` |
| `games` | `games_status_idx` | `status` |
| `game_players` | `game_players_game_id_idx` | `game_id` |
| `game_players` | `game_players_user_id_idx` | `user_id` |
| `game_events` | `game_events_game_id_idx` | `game_id` |
| `game_events` | `game_events_created_at_idx` | `created_at` |
| `user_achievements` | `user_achievements_user_achievement_idx` | `user_id`, `achievement_id` |
| `user_achievements` | `user_achievements_user_id_idx` | `user_id` |

## New indexes added

| Table | Index | Purpose | Accelerates |
| --- | --- | --- | --- |
| `games` | `games_status_ended_at_idx` | Covers ended-game ordering by newest completion time | `getLeaderboardRows()` |
| `verification` | `verification_identifier_idx` | Fast email/token identifier lookup | Better Auth verification and reset flows |
| `verification` | `verification_expires_at_idx` | Fast expiry cleanup scans | Verification token cleanup |

The generated migration is index-only and safe to deploy live.

## Query optimizations

`getGameTimelinesBatch(db, gameIds, perGameLimit)` replaces the `/history` N+1 timeline loader. It:

- accepts an array of game ids;
- uses a single SQL query;
- ranks events per game with `ROW_NUMBER()`;
- keeps only `rn <= perGameLimit`;
- returns a `Map<string, GameTimelineEvent[]>` keyed by game id.

The history page now loads games once, filters the ended games shown on the evidence wall, fetches all timelines in one batch, and renders the same view model as before.

## Foreign key audit

Cascade policy remains unchanged in this PR.

| Relationship | Policy | Reason |
| --- | --- | --- |
| `session.userId -> user.id` | CASCADE | Sessions are personal auth state and should be removed with the account |
| `account.userId -> user.id` | CASCADE | Provider accounts are personal auth state |
| `userAchievements.userId -> user.id` | CASCADE | Achievements are personal profile data |
| `gamePlayers.gameId -> games.id` | CASCADE | Deleting a game removes its player rows |
| `gameEvents.gameId -> games.id` | CASCADE | Deleting a game removes its event rows |
| `games.hostId -> user.id` | NO ACTION | Game history is anonymized before account deletion |
| `gamePlayers.userId -> user.id` | NO ACTION | Game history is anonymized before account deletion |
| `gameEvents.actorId -> user.id` | NO ACTION | Event history is anonymized before account deletion |
| `gameEvents.targetId -> user.id` | NO ACTION | Event history is anonymized before account deletion |

This preserves the anonymize-on-delete strategy and avoids deleting historical games when a user leaves.

## Future work

- DB-PERF-003: combine `getGameHistoryForUser` into a single join/subquery if account history becomes hot.
- DB-PERF-006: add `game_events_actor_id_idx` and `game_events_target_id_idx` when analytics or per-user event lookup needs them.
- Add measured `EXPLAIN ANALYZE` evidence after the seed-performance pass below.
- Consider a composite `game_events(game_id, created_at DESC)` index if the batch timeline query shows sorting pressure at larger event counts.

## Verification

Before deploying to production:

1. Seed test database with synthetic data: 1000 games, 30 players each, 10 events per game.
2. Run baseline query timing:

   ```sql
   EXPLAIN ANALYZE
   SELECT *
   FROM games
   WHERE status = 'ended'
   ORDER BY ended_at DESC
   LIMIT 500;
   ```

3. Expected: index scan on `games_status_ended_at_idx`, planning time < 1ms, execution < 10ms.

For batch timeline query:

```sql
EXPLAIN ANALYZE
SELECT id, game_id, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC) AS rn
FROM game_events
WHERE game_id = ANY(ARRAY[...20 uuids...]);
```

Expected: index scan on `game_events_game_id_idx`, total execution < 30ms.

Actual measurements are pending until the synthetic seed test is run against the local/staging database.
