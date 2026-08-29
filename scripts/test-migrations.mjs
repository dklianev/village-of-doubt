import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/werewolf_test";
const UPGRADE_TEST_DB_URL = process.env.UPGRADE_TEST_DATABASE_URL ?? databaseUrlWithSuffix(TEST_DB_URL, "_upgrade");
const CONFLICT_TEST_DB_URL = process.env.CONFLICT_TEST_DATABASE_URL ?? databaseUrlWithSuffix(TEST_DB_URL, "_conflict");
const migrationsDir = path.join(root, "packages/database/drizzle");
const databaseRequire = createRequire(path.join(root, "packages/database/package.json"));
const postgres = databaseRequire("postgres");
const { drizzle } = databaseRequire("drizzle-orm/postgres-js");
const { migrate } = databaseRequire("drizzle-orm/postgres-js/migrator");

async function recreateTestDb(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.slice(1);
  parsed.pathname = "/postgres";
  const sql = postgres(parsed.toString(), { max: 1 });

  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`);
    await sql.unsafe(`CREATE DATABASE ${quoteIdent(dbName)}`);
  } finally {
    await sql.end();
  }
}

async function runMigrations(databaseUrl, migrationsFolder = migrationsDir) {
  const client = postgres(databaseUrl, { max: 1 });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

async function verifySchema(databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const rows = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const tables = rows.map((row) => row.table_name);
    const expected = [
      "user",
      "session",
      "account",
      "verification",
      "deleted_user_identities",
      "game_session_revocations",
      "games",
      "game_events",
      "game_players",
      "user_achievements",
    ];
    const missing = expected.filter((table) => !tables.includes(table));
    if (missing.length > 0) {
      throw new Error(`Липсващи таблици: ${missing.join(", ")}`);
    }

    const constraints = await sql`
      SELECT table_constraint.constraint_name AS "name", pg_constraint.convalidated AS "validated"
      FROM information_schema.table_constraints AS table_constraint
      INNER JOIN pg_constraint
        ON pg_constraint.conname = table_constraint.constraint_name
      INNER JOIN pg_namespace
        ON pg_namespace.oid = pg_constraint.connamespace
      WHERE table_constraint.table_schema = 'public'
        AND pg_namespace.nspname = 'public'
        AND table_constraint.constraint_name IN (
          'games_status_check',
          'games_winner_team_check',
          'games_room_visibility_check',
          'game_players_death_round_check',
          'game_events_visibility_check',
          'game_events_round_check'
        )
    `;
    const expectedConstraints = [
      "games_status_check",
      "games_winner_team_check",
      "games_room_visibility_check",
      "game_players_death_round_check",
      "game_events_visibility_check",
      "game_events_round_check",
    ];
    const constraintState = new Map(
      constraints.map((constraint) => [constraint.name, constraint.validated]),
    );
    const missingConstraints = expectedConstraints.filter(
      (name) => constraintState.get(name) !== true,
    );
    if (missingConstraints.length > 0) {
      throw new Error(`Липсващи или невалидирани CHECK constraints: ${missingConstraints.join(", ")}`);
    }

    const indexes = await sql`
      SELECT indexname AS "name", indexdef AS "definition"
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'game_events_actor_id_idx',
          'game_events_target_id_idx',
          'game_players_lover_user_id_idx',
          'games_visibility_status_ended_at_idx',
          'games_status_updated_at_idx',
          'session_expires_at_idx'
        )
    `;
    const expectedIndexes = [
      "game_events_actor_id_idx",
      "game_events_target_id_idx",
      "game_players_lover_user_id_idx",
      "games_visibility_status_ended_at_idx",
      "games_status_updated_at_idx",
      "session_expires_at_idx",
    ];
    const indexState = new Map(indexes.map((index) => [index.name, index.definition]));
    const invalidIndexes = expectedIndexes.filter((name) => {
      const definition = indexState.get(name);
      const requiresPredicate = name.startsWith("game_events_") ||
        name === "game_players_lover_user_id_idx";
      return typeof definition !== "string" ||
        (requiresPredicate && !definition.includes(" WHERE "));
    });
    if (invalidIndexes.length > 0) {
      throw new Error(`Липсващи или непълни partial indexes: ${invalidIndexes.join(", ")}`);
    }

    const [accountDeletionFunctions] = await sql`
      SELECT
        to_regprocedure('public.werewolf_scrub_account_events(text, jsonb)') IS NULL AS "legacyScrubRemoved",
        NOT EXISTS (
          SELECT 1
          FROM pg_proc AS procedure
          CROSS JOIN LATERAL aclexplode(
            COALESCE(procedure.proacl, acldefault('f', procedure.proowner))
          ) AS privilege
          WHERE procedure.oid IN (
            'public.werewolf_prepare_account_deletion(text, text)'::regprocedure,
            'public.werewolf_scrub_account_events(text)'::regprocedure,
            'public.werewolf_scrub_account_event_value(jsonb, text, text, text[], boolean, boolean, text[], boolean)'::regprocedure,
            'public.werewolf_finalize_account_deletion(text, text)'::regprocedure,
            'public.werewolf_delete_account(text, text)'::regprocedure
          )
            AND privilege.grantee = 0
            AND privilege.privilege_type = 'EXECUTE'
        ) AS "publicExecuteRevoked"
    `;
    if (
      accountDeletionFunctions?.legacyScrubRemoved !== true
      || accountDeletionFunctions?.publicExecuteRevoked !== true
    ) {
      throw new Error(`Account deletion functions expose an unsafe API: ${JSON.stringify(accountDeletionFunctions)}`);
    }

    await sql`
      INSERT INTO "user" ("id", "name", "email")
      VALUES ('migration-schema-check-user', 'Проверка', 'migration-schema-check@invalid')
    `;
    await sql`
      INSERT INTO "games" (
        "id", "code", "host_id", "config", "ruleset_version", "status", "ended_at"
      )
      VALUES (
        '81111111-1111-1111-1111-111111111111',
        'ABANDONED',
        'migration-schema-check-user',
        '{}'::jsonb,
        'migration-test',
        'abandoned',
        now()
      )
    `;

    const deletedUserId = "account-deletion-schema-check";
    const anonymousUserId = `deleted_${"a".repeat(32)}`;
    const deletionGameId = "82222222-2222-2222-2222-222222222222";
    const deletionEventId = "83333333-3333-3333-3333-333333333333";
    const sameGameUnrelatedEventId = "87777777-7777-7777-7777-777777777777";
    const unrelatedUserId = "account-deletion-unrelated";
    const unrelatedGameId = "84444444-4444-4444-4444-444444444444";
    const unrelatedEventId = "85555555-5555-5555-5555-555555555555";
    await sql`
      INSERT INTO "user" ("id", "name", "email")
      VALUES
        (${deletedUserId}, 'Изтриван играч', 'account-deletion-check@invalid'),
        (${unrelatedUserId}, 'Несвързан играч', 'account-deletion-unrelated@invalid')
    `;
    await sql`
      INSERT INTO "games" ("id", "code", "host_id", "config", "ruleset_version")
      VALUES
        (${deletionGameId}, 'DELETEBOUNDARY', ${deletedUserId}, '{}'::jsonb, 'migration-test'),
        (${unrelatedGameId}, 'UNRELATED', ${unrelatedUserId}, '{}'::jsonb, 'migration-test')
    `;
    await sql`
      INSERT INTO "game_players" ("id", "game_id", "user_id", "display_name", "role")
      VALUES ('86666666-6666-6666-6666-666666666666', ${deletionGameId}, ${deletedUserId}, 'Изтриван играч', 'villager')
    `;
    await sql`
      INSERT INTO "game_events" ("id", "game_id", "round", "phase", "type", "actor_id", "visibility", "payload")
      VALUES
        (${deletionEventId}, ${deletionGameId}, 1, 'night', 'night_action', ${deletedUserId}, 'private', ${JSON.stringify({ userId: deletedUserId, role: "seer" })}::text::jsonb),
        (${sameGameUnrelatedEventId}, ${deletionGameId}, 1, 'night', 'night_action', ${unrelatedUserId}, 'private', ${JSON.stringify({ userId: unrelatedUserId, role: "werewolf" })}::text::jsonb),
        (${unrelatedEventId}, ${unrelatedGameId}, 1, 'night', 'night_action', ${unrelatedUserId}, 'private', ${JSON.stringify({ userId: unrelatedUserId })}::text::jsonb)
    `;

    await sql.begin(async (tx) => {
      const [deleted] = await tx`
        SELECT public.werewolf_delete_account(
          ${deletedUserId},
          ${anonymousUserId}
        ) AS "deleted"
      `;
      if (deleted?.deleted !== true) {
        throw new Error(`Atomic account deletion failed: ${JSON.stringify(deleted)}`);
      }
    });

    const [deletionState] = await sql`
      SELECT
        NOT EXISTS (SELECT 1 FROM "user" WHERE "id" = ${deletedUserId}) AS "originalRemoved",
        EXISTS (SELECT 1 FROM "user" WHERE "id" = ${anonymousUserId}) AS "anonymousExists",
        (SELECT "host_id" FROM "games" WHERE "id" = ${deletionGameId}) AS "hostId",
        (SELECT "user_id" FROM "game_players" WHERE "game_id" = ${deletionGameId}) AS "playerId",
        (SELECT "actor_id" FROM "game_events" WHERE "id" = ${deletionEventId}) AS "actorId",
        (SELECT "payload" FROM "game_events" WHERE "id" = ${deletionEventId}) AS "deletionPayload",
        (SELECT "payload" FROM "game_events" WHERE "id" = ${sameGameUnrelatedEventId}) AS "sameGameUnrelatedPayload",
        (SELECT "payload"->>'userId' FROM "game_events" WHERE "id" = ${unrelatedEventId}) AS "unrelatedPayloadUserId"
    `;
    if (
      deletionState?.originalRemoved !== true
      || deletionState?.anonymousExists !== true
      || deletionState?.hostId !== anonymousUserId
      || deletionState?.playerId !== anonymousUserId
      || deletionState?.actorId !== anonymousUserId
      || deletionState?.deletionPayload?.userId !== anonymousUserId
      || Object.hasOwn(deletionState?.deletionPayload ?? {}, "role")
      || deletionState?.sameGameUnrelatedPayload?.userId !== unrelatedUserId
      || deletionState?.sameGameUnrelatedPayload?.role !== "werewolf"
      || deletionState?.unrelatedPayloadUserId !== unrelatedUserId
    ) {
      throw new Error(`Account deletion boundary produced invalid state: ${JSON.stringify(deletionState)}`);
    }
  } finally {
    await sql.end();
  }
}

function createLegacyMigrationsFolder() {
  return createMigrationsFolderThrough(5, "werewolf-drizzle-legacy-");
}

function createMigrationsFolderThrough(maxIndex, prefix) {
  const journal = JSON.parse(readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8"));
  const legacyEntries = journal.entries.filter((entry) => entry.idx <= maxIndex);
  const legacyDir = mkdtempSync(path.join(tmpdir(), prefix));
  const legacyJournal = { ...journal, entries: legacyEntries };

  mkdirSync(path.join(legacyDir, "meta"));
  writeFileSync(path.join(legacyDir, "meta", "_journal.json"), JSON.stringify(legacyJournal, null, 2));
  for (const entry of legacyEntries) {
    copyFileSync(path.join(migrationsDir, `${entry.tag}.sql`), path.join(legacyDir, `${entry.tag}.sql`));
  }

  return { legacyDir, legacyEntries };
}

async function verifyConflictingLiveCodeUpgradeFails() {
  const userId = "duplicate-live-code-host";
  const { legacyDir, legacyEntries } = createMigrationsFolderThrough(
    12,
    "werewolf-drizzle-live-code-conflict-",
  );

  try {
    await recreateTestDb(CONFLICT_TEST_DB_URL);
    await runMigrations(CONFLICT_TEST_DB_URL, legacyDir);

    const before = postgres(CONFLICT_TEST_DB_URL, { max: 1 });
    try {
      await before`
        INSERT INTO "user" ("id", "name", "email")
        VALUES (${userId}, 'Домакин с конфликт', 'duplicate-live-code@invalid')
      `;
      await before`
        INSERT INTO "games" (
          "id", "code", "host_id", "config", "ruleset_version", "status"
        ) VALUES
          ('15555555-5555-5555-5555-555555555551', 'SAMECODE', ${userId}, '{}'::jsonb, 'legacy-test', 'lobby'),
          ('15555555-5555-5555-5555-555555555552', 'SAMECODE', ${userId}, '{}'::jsonb, 'legacy-test', 'active')
      `;
    } finally {
      await before.end();
    }

    let migrationFailure = "";
    try {
      await runMigrations(CONFLICT_TEST_DB_URL);
    } catch (error) {
      migrationFailure = error instanceof Error
        ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
        : String(error);
    }
    if (!migrationFailure.includes("Conflicting live game codes")) {
      throw new Error(`Expected live-code conflict diagnostic, received: ${migrationFailure || "no error"}`);
    }

    const after = postgres(CONFLICT_TEST_DB_URL, { max: 1 });
    try {
      const [state] = await after`
        SELECT
          (SELECT count(*)::int FROM "games" WHERE "code" = 'SAMECODE') AS "gameCount",
          (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS "migrationCount",
          to_regclass('public.games_live_code_uidx') IS NULL AS "indexAbsent"
      `;
      if (
        state?.gameCount !== 2
        || state?.migrationCount !== legacyEntries.length
        || !state?.indexAbsent
      ) {
        throw new Error(`Live-code conflict migration did not roll back cleanly: ${JSON.stringify(state)}`);
      }
    } finally {
      await after.end();
    }
  } finally {
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

async function verifyLegacyDeletedPlayersUpgrade() {
  const sentinelId = "00000000-0000-0000-0000-000000000000";
  const memberId = "legacy-member";
  const legacyGameId = "11111111-1111-1111-1111-111111111111";
  const duplicateGameId = "12222222-2222-2222-2222-222222222222";
  const archivedReuseGameId = "13333333-3333-3333-3333-333333333333";
  const { legacyDir, legacyEntries } = createLegacyMigrationsFolder();

  try {
    await recreateTestDb(UPGRADE_TEST_DB_URL);
    await runMigrations(UPGRADE_TEST_DB_URL, legacyDir);

    const before = postgres(UPGRADE_TEST_DB_URL, { max: 1 });
    try {
      const [applied] = await before`
        SELECT count(*)::int AS "count"
        FROM drizzle.__drizzle_migrations
      `;
      if (applied?.count !== legacyEntries.length) {
        throw new Error(`Expected ${legacyEntries.length} applied legacy migrations, received ${JSON.stringify(applied)}`);
      }

      await before`
        INSERT INTO "user" ("id", "name", "email")
        VALUES (${memberId}, 'Стар играч', 'legacy-member@invalid')
      `;
      await before`
        INSERT INTO "games" ("id", "code", "host_id", "config", "ruleset_version")
        VALUES
          (${legacyGameId}, 'LEGACY', ${sentinelId}, '{}'::jsonb, 'legacy-test'),
          (${duplicateGameId}, 'DEDUPLICATE', ${sentinelId}, '{}'::jsonb, 'legacy-test')
      `;
      await before`
        INSERT INTO "game_players" (
          "id", "game_id", "user_id", "display_name", "role", "is_alive",
          "death_round", "death_cause", "is_lover", "lover_user_id", "created_at"
        )
        VALUES
          ('21111111-1111-1111-1111-111111111111', ${legacyGameId}, ${sentinelId}, 'Изтрит играч', 'villager', true, null, null, false, null, '2026-01-01'),
          ('31111111-1111-1111-1111-111111111111', ${legacyGameId}, ${sentinelId}, 'Изтрит играч', 'doctor', true, null, null, false, null, '2026-01-02'),
          ('41111111-1111-1111-1111-111111111111', ${duplicateGameId}, ${memberId}, 'Стар играч', 'seer', false, 3, 'vote', true, ${sentinelId}, '2026-01-01'),
          ('51111111-1111-1111-1111-111111111111', ${duplicateGameId}, ${memberId}, 'Стар играч', 'seer', false, 3, 'vote', true, ${sentinelId}, '2026-01-02')
      `;
    } finally {
      await before.end();
    }

    await runMigrations(UPGRADE_TEST_DB_URL);

    const after = postgres(UPGRADE_TEST_DB_URL, { max: 1 });
    try {
      const [migrations] = await after`
        SELECT count(*)::int AS "count"
        FROM drizzle.__drizzle_migrations
      `;
      const expectedMigrationCount = JSON.parse(readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8")).entries.length;
      if (migrations?.count !== expectedMigrationCount) {
        throw new Error(`Drizzle migration history was not upgraded: ${JSON.stringify(migrations)}`);
      }

      let duplicateLiveCodeRejected = false;
      try {
        await after`
          INSERT INTO "games" ("id", "code", "host_id", "config", "ruleset_version")
          VALUES (${archivedReuseGameId}, 'LEGACY', ${sentinelId}, '{}'::jsonb, 'legacy-test')
        `;
      } catch (error) {
        duplicateLiveCodeRejected = error?.code === "23505"
          && error?.constraint_name === "games_live_code_uidx";
      }
      if (!duplicateLiveCodeRejected) {
        throw new Error("Live room code uniqueness was not enforced after migration 0013.");
      }

      await after`
        INSERT INTO "games" (
          "id", "code", "host_id", "config", "ruleset_version", "status", "ended_at"
        ) VALUES (
          ${archivedReuseGameId}, 'LEGACY', ${sentinelId}, '{}'::jsonb, 'legacy-test', 'ended', now()
        )
      `;

      const [legacyPlayers] = await after`
        SELECT
          count(*)::int AS "total",
          count(DISTINCT "user_id")::int AS "identities",
          array_agg("role" ORDER BY "role") AS "roles"
        FROM "game_players"
        WHERE "game_id" = ${legacyGameId}
      `;
      const deduplicatedPlayers = await after`
        SELECT "id", "display_name", "role", "is_alive", "death_round", "death_cause", "is_lover", "lover_user_id"
        FROM "game_players"
        WHERE "game_id" = ${duplicateGameId} AND "user_id" = ${memberId}
      `;
      const [expectedTables] = await after`
        SELECT
          to_regclass('public.deleted_user_identities') IS NOT NULL AS "deletedIdentities",
          to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS "drizzleMigrations",
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'user' AND column_name = 'avatar_id'
          ) AS "avatarId",
          EXISTS (
            SELECT 1
            FROM pg_index
            INNER JOIN pg_class ON pg_class.oid = pg_index.indexrelid
            INNER JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
            WHERE pg_namespace.nspname = 'public'
              AND pg_class.relname = 'game_players_game_user_idx'
              AND pg_index.indisunique
          ) AS "playerIndex",
          (SELECT count(*)::int FROM "games" WHERE "code" = 'LEGACY') AS "reusedCodeCount"
      `;

      if (legacyPlayers?.total !== 2 || legacyPlayers?.identities !== 2 || legacyPlayers?.roles?.join(",") !== "doctor,villager") {
        throw new Error(`Legacy deleted-player upgrade lost history: ${JSON.stringify(legacyPlayers)}`);
      }
      if (deduplicatedPlayers.length !== 1) {
        throw new Error(`Game-player deduplication failed: ${JSON.stringify(deduplicatedPlayers)}`);
      }
      const retainedPlayer = deduplicatedPlayers[0];
      if (
        retainedPlayer.id !== "41111111-1111-1111-1111-111111111111" ||
        retainedPlayer.display_name !== "Стар играч" ||
        retainedPlayer.role !== "seer" ||
        retainedPlayer.is_alive !== false ||
        retainedPlayer.death_round !== 3 ||
        retainedPlayer.death_cause !== "vote" ||
        retainedPlayer.is_lover !== true ||
        retainedPlayer.lover_user_id !== sentinelId
      ) {
        throw new Error(`Deduplication retained unexpected player values: ${JSON.stringify(retainedPlayer)}`);
      }
      if (
        !expectedTables?.deletedIdentities
        || !expectedTables?.drizzleMigrations
        || !expectedTables?.avatarId
        || !expectedTables?.playerIndex
        || expectedTables?.reusedCodeCount !== 2
      ) {
        throw new Error(`Expected migration tables are missing: ${JSON.stringify(expectedTables)}`);
      }
    } finally {
      await after.end();
    }
  } finally {
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

async function verifyConflictingDuplicateUpgradeFails() {
  const userId = "conflicting-member";
  const gameId = "14444444-4444-4444-4444-444444444444";
  const { legacyDir, legacyEntries } = createLegacyMigrationsFolder();

  try {
    await recreateTestDb(CONFLICT_TEST_DB_URL);
    await runMigrations(CONFLICT_TEST_DB_URL, legacyDir);

    const before = postgres(CONFLICT_TEST_DB_URL, { max: 1 });
    try {
      await before`
        INSERT INTO "user" ("id", "name", "email")
        VALUES (${userId}, 'Конфликтен играч', 'conflicting-member@invalid')
      `;
      await before`
        INSERT INTO "games" ("id", "code", "host_id", "config", "ruleset_version")
        VALUES (${gameId}, 'CONFLICT', ${userId}, '{}'::jsonb, 'legacy-test')
      `;
      await before`
        INSERT INTO "game_players" ("id", "game_id", "user_id", "display_name", "role", "created_at")
        VALUES
          ('61111111-1111-1111-1111-111111111111', ${gameId}, ${userId}, 'Конфликтен играч', 'villager', '2026-01-01'),
          ('71111111-1111-1111-1111-111111111111', ${gameId}, ${userId}, 'Конфликтен играч', 'seer', '2026-01-02')
      `;
    } finally {
      await before.end();
    }

    let migrationFailure = "";
    try {
      await runMigrations(CONFLICT_TEST_DB_URL);
    } catch (error) {
      migrationFailure = error instanceof Error
        ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
        : String(error);
    }
    if (!migrationFailure.includes("Conflicting duplicate game_players")) {
      throw new Error(`Expected conflicting duplicate diagnostic, received: ${migrationFailure || "no error"}`);
    }

    const after = postgres(CONFLICT_TEST_DB_URL, { max: 1 });
    try {
      const [state] = await after`
        SELECT
          (SELECT count(*)::int FROM "game_players" WHERE "game_id" = ${gameId} AND "user_id" = ${userId}) AS "playerCount",
          (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS "migrationCount",
          to_regclass('public.game_players_game_user_idx') IS NULL AS "indexAbsent"
      `;
      if (state?.playerCount !== 2 || state?.migrationCount !== legacyEntries.length || !state?.indexAbsent) {
        throw new Error(`Conflicting migration did not roll back cleanly: ${JSON.stringify(state)}`);
      }
    } finally {
      await after.end();
    }
  } finally {
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log("▶ Пресъздавам test database...");
  await recreateTestDb(TEST_DB_URL);

  console.log("▶ Пускам migrations...");
  await runMigrations(TEST_DB_URL);

  console.log("▶ Проверявам schema...");
  await verifySchema(TEST_DB_URL);

  console.log("▶ Проверявам upgrade от приложена стара 0005 migration...");
  await verifyLegacyDeletedPlayersUpgrade();

  console.log("▶ Проверявам отказ при конфликтни duplicate player rows...");
  await verifyConflictingDuplicateUpgradeFails();

  console.log("▶ Проверявам отказ при конфликтни активни кодове...");
  await verifyConflictingLiveCodeUpgradeFails();

  console.log("✓ Migration tests passed");
}

try {
  assertSafeTestDatabaseUrls([TEST_DB_URL, UPGRADE_TEST_DB_URL, CONFLICT_TEST_DB_URL]);
  if (process.env.MIGRATION_TEST_VALIDATE_ONLY === "1") {
    console.log("✓ Migration test database targets are safe");
  } else {
    await main();
  }
} catch (error) {
  const diagnostic = error instanceof Error
    ? error.stack ?? error.message
    : String(error);
  console.error("✗ Migration tests failed:", diagnostic);
  process.exit(1);
}

function quoteIdent(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function databaseUrlWithSuffix(databaseUrl, suffix) {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `${parsed.pathname}${suffix}`;
  return parsed.toString();
}

function assertSafeTestDatabaseUrls(databaseUrls) {
  const confirmedDatabases = new Set(
    (process.env.MIGRATION_TEST_CONFIRM_DATABASES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const databaseNames = databaseUrls.map((databaseUrl) => {
    const parsed = new URL(databaseUrl);
    const databaseName = decodeURIComponent(parsed.pathname.slice(1));
    const hasSafeSuffix = /_test(?:_(?:upgrade|conflict))?$/.test(databaseName);
    const isExplicitlyConfirmed = confirmedDatabases.has(databaseName);

    if (!databaseName || databaseName.includes("/") || ["postgres", "template0", "template1"].includes(databaseName)) {
      throw new Error(`Refusing destructive migration test for protected database "${databaseName || "<empty>"}".`);
    }
    if (!hasSafeSuffix && !isExplicitlyConfirmed) {
      throw new Error(
        `Refusing destructive migration test for database "${databaseName}". Use a _test suffix or list the exact name in MIGRATION_TEST_CONFIRM_DATABASES.`,
      );
    }
    return databaseName;
  });

  if (new Set(databaseNames).size !== databaseNames.length) {
    throw new Error("Migration test databases must have distinct names.");
  }
}
