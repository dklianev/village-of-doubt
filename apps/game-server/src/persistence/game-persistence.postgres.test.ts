import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createDatabase,
  deleteUserAccountAtomically,
  type Database,
} from "@werewolf/database";
import { DrizzleGamePersistence } from "./game-persistence.js";

const configuredDatabaseUrl = process.env.TEST_DATABASE_URL;
const postgresDescribe = configuredDatabaseUrl ? describe : describe.skip;
const baseDatabaseUrl = configuredDatabaseUrl ?? "postgres://invalid/unused";
const observerUrl = withApplicationName(baseDatabaseUrl, "identity-race-observer");
const blockerUrl = withApplicationName(baseDatabaseUrl, "identity-race-blocker");
const writerUrl = withApplicationName(baseDatabaseUrl, "identity-race-writer");
const deleterUrl = withApplicationName(baseDatabaseUrl, "identity-race-deleter");
const databaseUrls = [observerUrl, blockerUrl, writerUrl, deleterUrl];

interface RaceFixture {
  userId: string;
  anonymousUserId: string;
  hostId: string;
  gameId: string;
}

postgresDescribe("DrizzleGamePersistence identity deletion races (PostgreSQL)", () => {
  let observer!: Database;
  let blocker!: Database;
  let writer!: Database;
  let deleter!: Database;
  const fixtures: RaceFixture[] = [];

  beforeAll(async () => {
    observer = createDatabase(observerUrl);
    blocker = createDatabase(blockerUrl);
    writer = createDatabase(writerUrl);
    deleter = createDatabase(deleterUrl);
    const rows = await observer.execute<{ deletionFunction: string | null }>(sql`
      SELECT to_regprocedure('public.werewolf_delete_account(text, text)')::text AS "deletionFunction"
    `);
    if (!rows[0]?.deletionFunction) {
      throw new Error("TEST_DATABASE_URL must reference a migrated PostgreSQL test database.");
    }
  });

  afterEach(async () => {
    for (const fixture of fixtures.splice(0).reverse()) {
      await observer.execute(sql`DELETE FROM "games" WHERE "id" = ${fixture.gameId}`);
      await observer.execute(sql`
        DELETE FROM "user"
        WHERE "id" IN (${fixture.userId}, ${fixture.anonymousUserId}, ${fixture.hostId})
          OR "id" IN (
            SELECT "anonymous_user_id"
            FROM "deleted_user_identities"
            WHERE "original_user_id" = ${fixture.userId}
          )
      `);
      await observer.execute(sql`
        DELETE FROM "deleted_user_identities"
        WHERE "original_user_id" = ${fixture.userId}
      `);
    }
  });

  afterAll(async () => {
    await Promise.all(databaseUrls.map((databaseUrl) => closeDatabase(databaseUrl)));
  });

  it("serializes event insertion before deletion scrub when the writer wins the race", async () => {
    const fixture = await createRaceFixture(observer);
    fixtures.push(fixture);
    const persistence = new DrizzleGamePersistence(writer);
    const rowLocked = deferred();
    const releaseRow = deferred();
    const blockerTransaction = blocker.transaction(async (tx) => {
      await tx.execute(sql`SELECT "id" FROM "games" WHERE "id" = ${fixture.gameId} FOR UPDATE`);
      rowLocked.resolve();
      await releaseRow.promise;
    });
    await rowLocked.promise;

    let eventWrite: Promise<void> | undefined;
    let deletion: Promise<boolean> | undefined;
    try {
      eventWrite = persistence.recordEvent(fixture.gameId, {
        round: 2,
        phase: "night",
        type: "identity_race_event",
        actorId: fixture.userId,
        participantUserIds: [fixture.userId],
        payload: {
          actorId: fixture.userId,
          actorName: "Играч за изтриване",
          role: "seer",
        },
      });
      await waitForPostgresLock(observer, "identity-race-writer");

      deletion = deleteUserAccountAtomically(deleter, fixture.userId);
      await waitForPostgresLock(observer, "identity-race-deleter", "advisory");
      releaseRow.resolve();

      await expect(eventWrite).resolves.toBeUndefined();
      await expect(deletion).resolves.toBe(true);
    } finally {
      releaseRow.resolve();
      await Promise.allSettled([
        blockerTransaction,
        ...(eventWrite ? [eventWrite] : []),
        ...(deletion ? [deletion] : []),
      ]);
    }

    const tombstones = await observer.execute<{ anonymousUserId: string }>(sql`
      SELECT "anonymous_user_id" AS "anonymousUserId"
      FROM "deleted_user_identities"
      WHERE "original_user_id" = ${fixture.userId}
    `);
    const anonymousUserId = tombstones[0]?.anonymousUserId;
    expect(anonymousUserId).toMatch(/^deleted_[a-f0-9]{32}$/);
    const events = await observer.execute<{
      actorId: string | null;
      payload: Record<string, unknown>;
    }>(sql`
      SELECT "actor_id" AS "actorId", "payload"
      FROM "game_events"
      WHERE "game_id" = ${fixture.gameId} AND "type" = 'identity_race_event'
    `);
    expect(events).toEqual([{
      actorId: anonymousUserId,
      payload: {
        actorId: anonymousUserId,
        actorName: "Изтрит играч",
      },
    }]);
  });

  it("serializes achievement insertion before deletion removes the award", async () => {
    const fixture = await createRaceFixture(observer);
    fixtures.push(fixture);
    const persistence = new DrizzleGamePersistence(writer);
    const rowLocked = deferred();
    const releaseRow = deferred();
    const blockerTransaction = blocker.transaction(async (tx) => {
      await tx.execute(sql`SELECT "id" FROM "games" WHERE "id" = ${fixture.gameId} FOR UPDATE`);
      rowLocked.resolve();
      await releaseRow.promise;
    });
    await rowLocked.promise;

    let achievementWrite: Promise<void> | undefined;
    let deletion: Promise<boolean> | undefined;
    try {
      achievementWrite = persistence.recordAchievement(
        fixture.userId,
        "identity_race_award",
        fixture.gameId,
      );
      await waitForPostgresLock(observer, "identity-race-writer");

      deletion = deleteUserAccountAtomically(deleter, fixture.userId);
      await waitForPostgresLock(observer, "identity-race-deleter", "advisory");
      releaseRow.resolve();

      await expect(achievementWrite).resolves.toBeUndefined();
      await expect(deletion).resolves.toBe(true);
    } finally {
      releaseRow.resolve();
      await Promise.allSettled([
        blockerTransaction,
        ...(achievementWrite ? [achievementWrite] : []),
        ...(deletion ? [deletion] : []),
      ]);
    }

    const rows = await observer.execute<{ achievementCount: number }>(sql`
      SELECT count(*)::int AS "achievementCount"
      FROM "user_achievements"
      WHERE "game_id" = ${fixture.gameId}
        AND "achievement_id" = 'identity_race_award'
    `);
    expect(rows[0]?.achievementCount).toBe(0);
  });
});

async function createRaceFixture(db: Database): Promise<RaceFixture> {
  const suffix = randomUUID().replaceAll("-", "");
  const fixture = {
    userId: `race_user_${suffix.slice(0, 20)}`,
    anonymousUserId: `deleted_${suffix}`,
    hostId: `race_host_${suffix.slice(0, 20)}`,
    gameId: randomUUID(),
  };
  await db.execute(sql`
    INSERT INTO "user" ("id", "name", "email")
    VALUES
      (${fixture.userId}, 'Играч за изтриване', ${`${fixture.userId}@test.invalid`}),
      (${fixture.hostId}, 'Домакин', ${`${fixture.hostId}@test.invalid`})
  `);
  await db.execute(sql`
    INSERT INTO "games" ("id", "code", "host_id", "config", "ruleset_version")
    VALUES (
      ${fixture.gameId},
      ${`RACE${suffix.slice(0, 8).toUpperCase()}`},
      ${fixture.hostId},
      '{}'::jsonb,
      'identity-race-test'
    )
  `);
  return fixture;
}

async function waitForPostgresLock(
  observer: Database,
  applicationName: string,
  expectedLockType?: string,
  timeoutMs = 2_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await observer.execute<{ lockType: string }>(sql`
      SELECT waiting_lock."locktype" AS "lockType"
      FROM "pg_stat_activity" AS activity
      INNER JOIN "pg_locks" AS waiting_lock
        ON waiting_lock."pid" = activity."pid" AND NOT waiting_lock."granted"
      WHERE activity."application_name" = ${applicationName}
    `);
    if (rows.some((row) => !expectedLockType || row.lockType === expectedLockType)) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `PostgreSQL session ${applicationName} did not wait on the expected ${expectedLockType ?? "database"} lock.`,
  );
}

function withApplicationName(databaseUrl: string, applicationName: string) {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("application_name", applicationName);
  return parsed.toString();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
