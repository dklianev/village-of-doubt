# Codex prompt — Game balance review + Database performance review

Two parallel pre-launch audits with concrete fixes. Outputs:
1. `docs/balance-analysis.md` — full game balance analysis with preset adjustments + new validation tests.
2. `docs/db-performance-review.md` — DB query and index analysis with new indexes + query optimizations.

~10 atomic English commits across both tracks. Can be split into 2 PRs if preferred.

---

## Pre-analysis (from ChatGPT read-pass)

### Game balance — observed structure

**Role values are already system-defined** (sum of values = balance score). Code in `packages/shared/src/game-config.ts:295-300` exposes `getRoleBalanceScore(distribution)` returning the sum.

**Werewolf classic presets** at `packages/shared/src/game-config.ts:275-289`. Pattern: 2 werewolves up to 10 players, 3 wolves at 11-15, 4 wolves at 16-18+.

**Mafia sport preset** at line 302-308: fixed 10-player composition (6 civilian + 1 commissioner + 2 mafioso + 1 don).

### Game balance — issues found from analysis

#### B-001 — 10-player werewolf preset is village-favored (P2)

Composition: 4 ordinary_villager (+4) + 2 werewolf (−12) + seer (+7) + witch (+5) + healer (+3) + hunter (+3) = **+10 balance score**.

In our scale (0 is balanced; positive favors village), +10 is significant village advantage. Werewolves face 8 villagers including 4 information/protection roles (Seer, Witch, Healer, Hunter). Even with optimal werewolf play, win probability for wolves drops to ~25-35%.

**Suggested fix:** Drop Healer OR Witch (keep one). Reduces village advantage to +5, fairer.

```ts
10: { ordinary_villager: 5, werewolf: 2, seer: 1, witch: 1, hunter: 1 },
// Score: +5 (was +10)
// Or alternatively:
10: { ordinary_villager: 5, werewolf: 2, seer: 1, healer: 1, hunter: 1 },
```

#### B-002 — 12-player werewolf preset is village-favored (P2)

Composition: 5 ord_villager (+5) + 3 werewolf (−18) + seer (+7) + witch (+5) + healer (+3) + hunter (+3) = **+5 balance score**.

Numerically OK, but 4 special village roles vs 3 wolves means wolves have very limited margin for error. Should add an additional ordinary_villager OR remove one special.

**Suggested fix:** Reduce to 3 specials.

```ts
12: { ordinary_villager: 6, werewolf: 3, seer: 1, witch: 1, hunter: 1 },
// Score: +0 (perfectly balanced)
```

#### B-003 — 14, 15-player presets have too many ordinary villagers (P3)

14 players: 7 ord_villager (+7) + 3 werewolf (−18) + 4 specials (+18) = +7
15 players: 8 ord_villager (+8) + 3 werewolf (−18) + 4 specials (+18) = +8

Both are positive (village-favored). For these sizes, adding a 4th wolf would help:

```ts
14: { ordinary_villager: 6, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
// Score: +6 − 24 + 18 = 0 (balanced)
15: { ordinary_villager: 7, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
// Score: +7 − 24 + 18 = +1
```

This shifts the current "5 wolves at 16+" threshold down to "4 wolves at 14+" — earlier scaling.

#### B-004 — 6 and 7-player presets: too small for protection chain (P3)

6 players: 2 wolves + 2 villagers + seer + healer
- Score: +2 − 12 + 7 + 3 = 0 (technically balanced)
- BUT: at 6 players, parity hits when only 2 wolves remain alive vs 2 anything else. After night 1 (−1 villager), parity = 2W vs 2V (one of which is seer or healer). With healer guessing correctly 30% of nights, wolves likely win on night 2. Win rate prediction: ~60% wolves.

7 players: 3 ord_villager + 2 wolves + seer + healer
- Score: +3 − 12 + 7 + 3 = +1 (mild village advantage)
- Similar dynamic — wolves likely 50-55%.

These are designed for first-game experience, so leaning slightly toward village (so newbies don't always lose to wolves) is intentional. Current 6 and 7-player setups are probably OK. **Note as "intended" not "fixable".**

#### B-005 — `getRoleBalanceScore` has no validation gate at preset creation (P3)

`getRoleBalanceScore` exists as a utility but isn't called anywhere to validate presets at definition time. We could add a unit test that asserts every preset's score falls in an acceptable range:

```ts
// New test: balance-score-validation.test.ts
const ACCEPTABLE_RANGE = [-3, +6];

for (const [playerCount, preset] of Object.entries(WEREWOLF_CLASSIC_PRESETS)) {
  const score = getRoleBalanceScore(preset);
  expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_RANGE[0]);
  expect(score).toBeLessThanOrEqual(ACCEPTABLE_RANGE[1]);
}
```

#### B-006 — No "max specials per game" cap (P3)

Currently a host can build a wizard composition with 7+ special roles. Combined with 2-3 wolves, this creates an unplayable game (every villager has a role/ability; wolves have no privacy).

**Suggested addition:** soft warning in lobby wizard when special role count >= total_players / 2.

**Out of scope for this PR.** Track in `docs/post-launch-todo.md`.

#### B-007 — Mafia preset is well-tuned (no fix needed)

10-player sport: 6 civilian (+6) + commissioner (+6) + 2 mafioso (−10) + don (−6) = **−4 balance**.

Negative means slight mafia advantage, which matches sport mafia's traditional tighter playstyle. Acceptable.

### Database performance — observed structure

**Indexes present** (per `packages/database/src/schema.ts`):
- `session_user_id_idx`, `account_user_id_idx`
- `games_code_idx`, `games_host_id_idx`, `games_status_idx`
- `game_players_game_id_idx`, `game_players_user_id_idx`
- `game_events_game_id_idx`, `game_events_created_at_idx`
- `user_achievements_user_achievement_idx`, `user_achievements_user_id_idx`

**Foreign keys with cascade:**
- `session.userId → user.id` CASCADE ✓ (purge sessions on delete)
- `account.userId → user.id` CASCADE ✓
- `userAchievements.userId → user.id` CASCADE ✓
- `gamePlayers.gameId → games.id` CASCADE ✓ (game deleted → players gone)
- `gameEvents.gameId → games.id` CASCADE ✓

**Foreign keys WITHOUT cascade** (correct for anonymize strategy):
- `games.hostId → user.id` NO ACTION ✓
- `gamePlayers.userId → user.id` NO ACTION ✓
- `gameEvents.actorId/targetId → user.id` NO ACTION ✓

### Database performance — issues found

#### DB-PERF-001 — Missing index on `games.endedAt` (P1)

`getLeaderboardRows(limit=500)` in `queries.ts:124-137` orders by `desc(games.endedAt)` after filtering `status = "ended"`. Without an index on `endedAt`, this scans all rows in the `games` table.

For early launch (~1000 games) this is fine. By 10K games, it becomes noticeably slow (50-200ms). Add composite index.

**Fix:** New migration adds `games_status_ended_at_idx` on `(status, endedAt)`. Covers the hot query path.

```ts
// schema.ts addition
index("games_status_ended_at_idx").on(table.status, table.endedAt.desc()),
```

#### DB-PERF-002 — N+1 timeline queries in `getRecentGameHistory` (P1)

In `queries.ts:41-71` and `apps/web/app/history/page.tsx:101`:

```ts
const games = await getRecentGameHistory(db);
const timelines = await Promise.all(games.map((game) => getGameTimeline(db, game.id, 6)));
```

For 20 games = **20 separate SELECT queries** for timelines. Network round-trips compound.

**Fix:** Add new query function `getGameTimelinesBatch(db, gameIds[], perGameLimit=6)` that fetches all timelines in one query, then groups by gameId in app.

```ts
export async function getGameTimelinesBatch(
  db: Database,
  gameIds: string[],
  perGameLimit = 6,
): Promise<Map<string, GameTimelineEvent[]>> {
  if (gameIds.length === 0) return new Map();

  // Use a window function for per-game limit
  const result = await db.execute(sql`
    SELECT id, game_id, round, phase, type, actor_id, target_id, visibility, payload, created_at
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC) AS rn
      FROM game_events
      WHERE game_id IN (${sql.join(gameIds.map((id) => sql`${id}`), sql`, `)})
    ) ranked
    WHERE rn <= ${perGameLimit}
    ORDER BY game_id, created_at DESC
  `);

  const grouped = new Map<string, GameTimelineEvent[]>();
  for (const row of result.rows ?? []) {
    const id = row.game_id as string;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push({
      id: row.id as string,
      round: row.round as number,
      phase: row.phase as string,
      type: row.type as string,
      actorId: row.actor_id as string | null,
      targetId: row.target_id as string | null,
      visibility: row.visibility as string,
      payload: row.payload,
      createdAt: row.created_at as Date,
    });
  }
  return grouped;
}
```

Then update `history/page.tsx` to use this batch fetch.

#### DB-PERF-003 — `getGameHistoryForUser` runs 3 sequential queries (P2)

In `queries.ts:129-...`: separate queries for player_games, games_filtered, event_counts. Could be combined into a single JOIN with subquery.

For now, this is OK because user-history is fetched only when /account is opened (rare). Mark as P2; defer optimization until after launch metrics show actual usage.

#### DB-PERF-004 — Missing index on `verification.identifier` (P1)

Better Auth queries `verification` table by `identifier` (email or token) for password reset / email verification lookups. Without an index, scan is O(n) on entire verification table.

**Fix:** Add `verification_identifier_idx` on `verification.identifier`.

```ts
export const verification = pgTable(
  "verification",
  {
    // ... existing fields
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);
```

The `expires_at` index supports cleanup queries (delete expired tokens).

#### DB-PERF-005 — Connection pool not explicitly configured (P2)

`packages/database/src/client.ts` (need to check actual file). If using default `pg.Pool()`, max connections = 10. For our load (web server + game server + cron) could exhaust under viral spike.

**Fix:** Explicitly configure pool with `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`. Document in client.ts.

#### DB-PERF-006 — Missing index on `gameEvents.actorId` and `targetId` (P3)

These FKs reference user but lack indexes. Queries that filter "events where user X was actor" would be slow.

Currently no such query exists. Mark as P3; add if/when analytics or per-user event lookup is implemented.

---

## Pre-locked decisions

- **Acceptable balance score range:** `-3` to `+6`. Negative slightly favors threat, positive slightly favors village. We allow more positive deviation than negative because village losing to wolves "by design" feels worse for new players than wolves losing.
- **Preset migration approach:** in-place edits to `WEREWOLF_CLASSIC_PRESETS`. Old games keep their original config (stored in `games.config` JSONB column).
- **Migration strategy for DB indexes:** Drizzle generates migrations via `pnpm --filter @werewolf/database db:generate`. Apply via `pnpm --filter @werewolf/database db:migrate`.
- **No data migration:** We do NOT recompute historical balance scores or rewrite old game configs.
- **Branch:** `feat/balance-and-db-tuning`. Single PR with two clear sections.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo. Read `AGENTS.md`, `docs/regression-audit/REPORT.md`, and `docs/rules-bg.md` first.

Invariants:
- All commit messages in **English** (project convention).
- All user-facing copy in **Bulgarian** Cyrillic.
- No new npm dependencies.
- Branch: `feat/balance-and-db-tuning`.

This PR addresses two parallel pre-launch concerns identified in ChatGPT analysis: game balance tuning (B-001..006) and database performance hardening (DB-PERF-001..006).

The "Pre-analysis" section above is your input data — treat findings as instructions to implement, not as suggestions to validate.

---

## Track A — Game balance tuning

### Stage A1 — Write the analysis document

Create `docs/balance-analysis.md` with:
- Reproduce the "Game balance — observed structure" + "issues found" sections from the Pre-analysis above as a standalone document.
- Add a section "Current preset table" listing every player count from 6 to 18+ with: composition, balance score, predicted win rate (use simple heuristics — high score = village favored).
- Add a section "Post-fix preset table" reflecting the changes you'll make in A2.
- Add a section "Validation strategy" explaining the new tests added in A3.
- Add a section "Tuning protocol" with a 4-week post-launch plan: collect actual game outcomes, recompute balance scores, propose adjustments. This is a placeholder; not implemented in this PR.

This file is the **canonical record** of why presets are what they are. Future contributors should read it before adjusting role values or compositions.

### Stage A2 — Adjust preset compositions

**File:** `packages/shared/src/game-config.ts:275-289`

Apply these exact preset replacements:

```ts
const WEREWOLF_CLASSIC_PRESETS: Record<number, RoleDistribution> = {
  6: { ordinary_villager: 2, werewolf: 2, seer: 1, healer: 1 },                                       // unchanged (intentional small-game tuning)
  7: { ordinary_villager: 3, werewolf: 2, seer: 1, healer: 1 },                                       // unchanged
  8: { ordinary_villager: 3, werewolf: 2, seer: 1, healer: 1, hunter: 1 },                            // unchanged (baseline default)
  9: { ordinary_villager: 4, werewolf: 2, seer: 1, witch: 1, hunter: 1 },                             // unchanged
  10: { ordinary_villager: 5, werewolf: 2, seer: 1, witch: 1, hunter: 1 },                            // B-001 fix: drop healer
  11: { ordinary_villager: 5, werewolf: 3, seer: 1, witch: 1, hunter: 1 },                            // unchanged
  12: { ordinary_villager: 6, werewolf: 3, seer: 1, witch: 1, hunter: 1 },                            // B-002 fix: drop healer
  13: { ordinary_villager: 6, werewolf: 3, seer: 1, witch: 1, healer: 1, hunter: 1 },                 // unchanged
  14: { ordinary_villager: 6, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },                 // B-003 fix: 4 wolves earlier
  15: { ordinary_villager: 7, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },                 // B-003 fix: 4 wolves earlier
  16: { ordinary_villager: 8, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },                 // unchanged
  17: { ordinary_villager: 9, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },                 // unchanged
  18: { ordinary_villager: 10, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },                // unchanged
};
```

Also update the auto-scaling logic at line 328-336 (for 19+ players):

```ts
const werewolves = playerCount <= 22 ? 5 : playerCount <= 28 ? 6 : 7;
return {
  ordinary_villager: playerCount - werewolves - 4,
  werewolf: werewolves,
  seer: 1,
  witch: 1,
  healer: 1,
  hunter: 1,
};
```

(Adds 7 wolves at 29-30 players; current code caps at 6.)

### Stage A3 — Balance validation tests

**File:** New `packages/shared/src/__tests__/balance-score.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  countRoles,
  getRoleBalanceScore,
  getWerewolvesClassicPreset,
  getMafiaSportPreset,
  getMafiaFreePreset,
} from "../game-config.js";

const ACCEPTABLE_WEREWOLF_RANGE = [-3, 6] as const;
const ACCEPTABLE_MAFIA_RANGE = [-6, 4] as const;

describe("Werewolf preset balance scores", () => {
  for (let playerCount = 6; playerCount <= 18; playerCount += 1) {
    it(`preset for ${playerCount} players has balance score in [${ACCEPTABLE_WEREWOLF_RANGE[0]}, ${ACCEPTABLE_WEREWOLF_RANGE[1]}]`, () => {
      const preset = getWerewolvesClassicPreset(playerCount);
      const score = getRoleBalanceScore(preset);

      expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_WEREWOLF_RANGE[0]);
      expect(score).toBeLessThanOrEqual(ACCEPTABLE_WEREWOLF_RANGE[1]);
    });

    it(`preset for ${playerCount} players has the correct total count`, () => {
      const preset = getWerewolvesClassicPreset(playerCount);
      expect(countRoles(preset)).toBe(playerCount);
    });
  }

  it("scaling presets (19-30 players) stay within range", () => {
    for (let playerCount = 19; playerCount <= 30; playerCount += 1) {
      const preset = getWerewolvesClassicPreset(playerCount);
      const score = getRoleBalanceScore(preset);
      expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_WEREWOLF_RANGE[0]);
      expect(score).toBeLessThanOrEqual(ACCEPTABLE_WEREWOLF_RANGE[1]);
      expect(countRoles(preset)).toBe(playerCount);
    }
  });
});

describe("Mafia preset balance scores", () => {
  it("sport mafia (10) is within acceptable range", () => {
    const preset = getMafiaSportPreset(10);
    const score = getRoleBalanceScore(preset);
    expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_MAFIA_RANGE[0]);
    expect(score).toBeLessThanOrEqual(ACCEPTABLE_MAFIA_RANGE[1]);
    expect(countRoles(preset)).toBe(10);
  });

  it("free mafia presets are within range", () => {
    for (let playerCount = 4; playerCount <= 24; playerCount += 1) {
      let preset;
      try {
        preset = getMafiaFreePreset(playerCount);
      } catch {
        continue; // skip player counts not in the table
      }
      const score = getRoleBalanceScore(preset);
      expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_MAFIA_RANGE[0]);
      expect(score).toBeLessThanOrEqual(ACCEPTABLE_MAFIA_RANGE[1]);
    }
  });
});

describe("Preset role count integrity", () => {
  it("werewolf presets always include at least 2 werewolves", () => {
    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      const preset = getWerewolvesClassicPreset(playerCount);
      expect((preset.werewolf ?? 0)).toBeGreaterThanOrEqual(2);
    }
  });

  it("werewolf presets always include a seer", () => {
    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      const preset = getWerewolvesClassicPreset(playerCount);
      expect((preset.seer ?? 0)).toBeGreaterThanOrEqual(1);
    }
  });
});
```

Run `pnpm --filter @werewolf/shared test` after — should all pass with new presets.

### Stage A4 — Update post-launch tracking doc

**File:** `docs/post-launch-todo.md` (if exists, append; otherwise create)

Add section:

```markdown
## Balance tuning protocol (post-launch)

After 4 weeks of public play, collect game outcomes:

1. Query: for each preset (by player count + family), compute actual win rates per faction
2. Compare actual win rates to predicted (based on balance score)
3. If actual deviation > 15% from 50/50, adjust preset:
   - Village wins too often: increase wolf count or decrease specials
   - Wolves win too often: opposite
4. Push adjustments via PR. Update `docs/balance-analysis.md` post-fix table.

Tracking: `docs/balance-analysis.md` "Tuning protocol" section.

Implementation deferred until we have analytics. See `docs/decisions/` for related decisions.
```

---

## Track B — Database performance hardening

### Stage B1 — Write the analysis document

Create `docs/db-performance-review.md` with:
- Reproduce the "Database performance — observed structure" + "issues found" sections from the Pre-analysis above.
- Add a section "Existing indexes" listing every current index from `schema.ts`.
- Add a section "New indexes added" with each new index, its purpose, and which query it accelerates.
- Add a section "Query optimizations" describing the batch timeline loader.
- Add a section "Foreign key audit" confirming the cascade policy (CASCADE on personal-data FKs, NO ACTION on game-history FKs to support anonymize-on-delete).
- Add a section "Future work" listing P2/P3 items not addressed.

### Stage B2 — Add new indexes

**File:** `packages/database/src/schema.ts`

Update the `games` table definition:

```ts
export const games = pgTable(
  "games",
  {
    // ... existing columns unchanged
  },
  (table) => [
    index("games_code_idx").on(table.code),
    index("games_host_id_idx").on(table.hostId),
    index("games_status_idx").on(table.status),
    index("games_status_ended_at_idx").on(table.status, table.endedAt.desc()), // NEW: DB-PERF-001
  ],
);
```

Update the `verification` table:

```ts
export const verification = pgTable(
  "verification",
  {
    // ... existing columns
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier), // NEW: DB-PERF-004
    index("verification_expires_at_idx").on(table.expiresAt),   // NEW: DB-PERF-004
  ],
);
```

Then generate the migration:

```bash
pnpm --filter @werewolf/database db:generate
```

This will produce a new SQL migration file. Inspect it, confirm it only adds indexes (no destructive changes), and commit.

### Stage B3 — Add batch timeline query

**File:** `packages/database/src/queries.ts`

Add at the end of the file (or near `getGameTimeline`):

```ts
export async function getGameTimelinesBatch(
  db: Database,
  gameIds: string[],
  perGameLimit = 6,
): Promise<Map<string, GameTimelineEvent[]>> {
  if (gameIds.length === 0) return new Map();

  // Use ROW_NUMBER() window function for per-game limit in a single query.
  const placeholders = gameIds.map(() => "?").join(", ");
  const rows = await db.execute<{
    id: string;
    game_id: string;
    round: number;
    phase: string;
    type: string;
    actor_id: string | null;
    target_id: string | null;
    visibility: string;
    payload: unknown;
    created_at: Date;
  }>(sql`
    SELECT id, game_id, round, phase, type, actor_id, target_id, visibility, payload, created_at
    FROM (
      SELECT
        id, game_id, round, phase, type, actor_id, target_id, visibility, payload, created_at,
        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC) AS rn
      FROM game_events
      WHERE game_id = ANY(${sql.array(gameIds, "uuid")})
    ) ranked
    WHERE rn <= ${perGameLimit}
    ORDER BY game_id, created_at DESC
  `);

  const grouped = new Map<string, GameTimelineEvent[]>();
  const collection = (rows as unknown as { rows: typeof rows[number][] }).rows ?? rows;

  for (const row of collection as Array<{
    id: string;
    game_id: string;
    round: number;
    phase: string;
    type: string;
    actor_id: string | null;
    target_id: string | null;
    visibility: string;
    payload: unknown;
    created_at: Date;
  }>) {
    const list = grouped.get(row.game_id) ?? [];
    list.push({
      id: row.id,
      round: row.round,
      phase: row.phase,
      type: row.type,
      actorId: row.actor_id,
      targetId: row.target_id,
      visibility: row.visibility,
      payload: row.payload,
      createdAt: row.created_at,
    });
    grouped.set(row.game_id, list);
  }

  return grouped;
}
```

Export from `packages/database/src/index.ts`.

(Codex: adjust the type assertions to match how Drizzle's `sql` template and `db.execute` actually return rows in this codebase. If `db.execute` returns an iterable with `.rows`, use that; if it returns a plain array, simplify. Run `pnpm typecheck` after.)

### Stage B4 — Replace N+1 timeline loader in history page

**File:** `apps/web/app/history/page.tsx`

Find the `loadHistory()` function (around line 93-107) and replace:

```ts
// OLD:
const games = await getRecentGameHistory(db);
const timelines = await Promise.all(games.map((game) => getGameTimeline(db, game.id, 6)));
return games.map((game, index) => ({ ...game, mode: modeFromConfig(game.config), timeline: timelines[index] ?? [] }));

// NEW:
const games = await getRecentGameHistory(db);
const timelinesMap = await getGameTimelinesBatch(db, games.map((g) => g.id), 6);
return games.map((game) => ({
  ...game,
  mode: modeFromConfig(game.config),
  timeline: timelinesMap.get(game.id) ?? [],
}));
```

Import `getGameTimelinesBatch` from `@werewolf/database`.

Test: `pnpm --filter web test` should still pass. Open `/history` (with seeded data); should render exactly the same content, just faster.

### Stage B5 — Configure connection pool

**File:** `packages/database/src/client.ts`

Read the current implementation. If it uses default `pg.Pool()`, update to explicit config:

```ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof drizzle>;

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({
    connectionString,
    max: 20,                          // up from default 10
    idleTimeoutMillis: 30_000,        // close idle connections after 30s
    connectionTimeoutMillis: 5_000,   // fail connection attempts after 5s
    statement_timeout: 15_000,        // kill queries that exceed 15s
  });

  // Log pool errors (don't crash on transient failures)
  pool.on("error", (error) => {
    console.error("[db-pool]", error);
  });

  return drizzle(pool, { schema });
}
```

If client.ts uses a different pattern (e.g., `postgres.js` library or another driver), adapt accordingly.

### Stage B6 — Performance test (manual instructions in doc)

Add to `docs/db-performance-review.md` final section:

```markdown
## Verification

Before deploying to production:

1. Seed test database with synthetic data: 1000 games, 30 players each, 10 events per game.
2. Run baseline query timing:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM games WHERE status = 'ended' ORDER BY ended_at DESC LIMIT 500;
   ```
3. Expected: index scan on `games_status_ended_at_idx`, planning time < 1ms, execution < 10ms.

For batch timeline query:
   ```sql
   EXPLAIN ANALYZE
   SELECT id, game_id, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC) AS rn
   FROM game_events
   WHERE game_id = ANY(ARRAY[...20 uuids...]);
   ```
3. Expected: index scan on `game_events_game_id_idx`, total execution < 30ms.

Document actual measurements after seed test in this section as evidence the optimizations work.
```

---

## Acceptance criteria

1. **`docs/balance-analysis.md`** exists with all 6 sections (observed structure, issues, current/post-fix tables, validation, tuning protocol).
2. **`docs/db-performance-review.md`** exists with all 6 sections (observed structure, issues, existing/new indexes, optimizations, FK audit, future work).
3. **Werewolf preset changes** in `game-config.ts:275-289` applied: drops healer at 10 and 12 player counts; adds 4th wolf at 14 and 15.
4. **Auto-scaling for 19+** updated to add 7 wolves at 29-30 players.
5. **Balance validation tests** in `balance-score.test.ts` pass for all player counts 6-30 (werewolf) and 4-24 (mafia where defined).
6. **New indexes** in schema: `games_status_ended_at_idx`, `verification_identifier_idx`, `verification_expires_at_idx`.
7. **Migration generated** via `pnpm --filter @werewolf/database db:generate`; SQL inspected; only contains CREATE INDEX (no destructive ops).
8. **Batch timeline loader** `getGameTimelinesBatch` exported from `@werewolf/database` and used in `history/page.tsx`.
9. **Connection pool config** updated in `client.ts` with explicit `max: 20`, timeouts, and error logging.
10. **`pnpm test`** passes including the new balance tests.
11. **`pnpm typecheck`** passes.
12. **`pnpm build`** passes.
13. **`pnpm verify`** passes end to end.
14. **`docs/post-launch-todo.md`** updated with balance tuning protocol section.

---

## Не пипай

- Game-server logic / role-assignment internals.
- Role definitions in `packages/shared/src/games/werewolf/roles.ts` and `mafia/roles.ts` (values stay as-is).
- `getRoleBalanceScore` implementation (just use it in tests).
- Historical games already in DB (no retroactive recomputation).
- Existing query functions in `queries.ts` (just add new batch helper; replace consumers carefully).
- Better Auth tables structure (only add indexes to `verification`).
- FK cascade policies (already correct per anonymize strategy).

---

## Commit strategy (10 atomic English commits)

Branch: `feat/balance-and-db-tuning`

Track A — Game balance:

1. `docs(balance): pre-launch balance analysis with findings and tuning plan`
2. `feat(shared): tune werewolf classic presets for 10, 12, 14, 15 player counts`
3. `feat(shared): bump auto-scaling werewolf count for 29-30 player tables`
4. `test(shared): balance score and role count validation for all presets`
5. `docs(roadmap): add post-launch balance tuning protocol to todo`

Track B — Database performance:

6. `docs(db): pre-launch database performance review`
7. `feat(db): add composite index on games(status, ended_at desc)`
8. `feat(db): index verification table for identifier and expiry lookups`
9. `feat(db): add batch timeline loader to fix history page N+1 query`
10. `feat(db): explicit connection pool configuration with timeouts`

PR title: `feat: pre-launch balance and database tuning`

PR body should:
- Link `docs/balance-analysis.md` and `docs/db-performance-review.md`.
- Note: schema migration is index-only (safe to deploy live).
- Note: preset changes affect new games only; historical games keep their original config.
- Mention the post-launch tuning protocol as next-step (week 4 review).

---

## Verification

After all stages:

```bash
pnpm install
pnpm --filter @werewolf/shared test       # new balance tests pass
pnpm --filter @werewolf/database db:generate  # generates migration file
# inspect new migration, ensure only CREATE INDEX
cat packages/database/drizzle/<new-migration>.sql
pnpm --filter @werewolf/database db:migrate   # apply to local DB
pnpm typecheck
pnpm build
pnpm regression
pnpm test
pnpm smoke
pnpm frontend:e2e
E2E_LOCAL_ONLY=true pnpm e2e:auth
pnpm playtest
pnpm visual
pnpm perf:budget
```

Manual checks:
- Open `/history` (with seeded games) → renders correctly + visibly faster than before.
- Run `EXPLAIN ANALYZE` on the leaderboard query → uses new index.
- Run new balance tests in isolation → all pass.
- Inspect generated migration SQL → only CREATE INDEX statements.

---

(End of prompt)
