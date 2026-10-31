import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { closeDatabase, createDatabase, type Database } from "./client.js";
import { AccountExportChangedError, deleteUserAccountAtomically, getAccountExportPage, getLeaderboardRows, parseAccountExportCursor } from "./queries.js";

const url = process.env.TEST_DATABASE_URL;
const run = randomUUID();
const names = ["observer", "blocker", "first", "second"].map((name) => `export-privacy-${name}-${run}`);
const urls = names.map((name) => {
  const parsed = new URL(url ?? "postgres://localhost/unused_test");
  parsed.searchParams.set("application_name", name);
  return parsed.toString();
});
const users: string[] = [];
let db: Database;
let blocker: Database;
let first: Database;
let second: Database;
const page = { page: 1, pageSize: 1, eventPage: 1, eventPageSize: 1 };

describe.skipIf(!url)("query and privacy contracts on PostgreSQL", () => {
  beforeAll(() => {
    const target = new URL(url!);
    if (!/(?:^|[_-])test(?:$|[_-])/.test(target.pathname.slice(1))) throw new Error("A dedicated test database is required");
    db = createDatabase(urls[0]!);
    blocker = createDatabase(urls[1]!);
    first = createDatabase(urls[2]!);
    second = createDatabase(urls[3]!);
  });
  afterEach(async () => {
    for (const id of users.splice(0).reverse()) {
      await db.execute(sql`DELETE FROM games WHERE host_id = ${id}`);
      await db.execute(sql`DELETE FROM game_players WHERE user_id = ${id}`);
      await db.execute(sql`DELETE FROM "user" WHERE id = ${id} OR id IN (SELECT anonymous_user_id FROM deleted_user_identities WHERE original_user_id = ${id})`);
      await db.execute(sql`DELETE FROM deleted_user_identities WHERE original_user_id = ${id}`);
    }
  });
  afterAll(async () => { for (const value of urls) await closeDatabase(value); });

  it("decodes the real leaderboard aggregate before page serialization", async () => {
    const owner = await makeUser();
    const game = await makeGame(owner);
    await db.execute(sql`UPDATE games SET status = 'ended', room_visibility = 'public', ended_at = '2026-10-16 12:00:00' WHERE id = ${game}`);
    await db.execute(sql`INSERT INTO game_players (game_id, user_id, display_name, role, won) VALUES (${game}, ${owner}, 'Synthetic', 'seer', true)`);
    const row = (await getLeaderboardRows(db, 10, { since: new Date("2026-10-15T00:00:00Z") })).find((item) => item.userId === owner);
    expect(row?.lastPlayedAt).toBeInstanceOf(Date);
    expect(row?.lastPlayedAt?.toISOString()).toBe("2026-10-16T12:00:00.000Z");
  });

  it("preserves microseconds across game and event page boundaries", async () => {
    const owner = await makeUser();
    const newer = await makeGame(owner, "2026-10-16 12:00:00.123900");
    const older = await makeGame(owner, "2026-10-16 12:00:00.123100");
    const eventIds = [randomUUID(), randomUUID()];
    for (const [index, time] of ["2026-10-16 12:00:00.123900", "2026-10-16 12:00:00.123100"].entries()) {
      await db.execute(sql`INSERT INTO game_events (id, game_id, round, phase, type, actor_id, created_at)
        VALUES (${eventIds[index]}, ${newer}, 1, 'day', 'chat', ${owner}, ${time}::timestamp)`);
    }
    const initial = await getAccountExportPage(db, owner, page);
    const gameNext = await getAccountExportPage(db, owner, { ...page, gameCursor: parseAccountExportCursor(initial.nextGameCursor) });
    const eventNext = await getAccountExportPage(db, owner, { ...page, batchGameIds: initial.batchGameIds, eventCursor: parseAccountExportCursor(initial.nextEventCursor) });
    expect(initial.games.map((game) => game.id)).toEqual([newer]);
    expect(gameNext.games.map((game) => game.id)).toEqual([older]);
    expect([...initial.games[0]!.events, ...eventNext.games[0]!.events].map((event) => event.id)).toEqual(eventIds);
  });

  it("keeps the 100-game event batch stable while new games and events arrive", async () => {
    const owner = await makeUser();
    await db.execute(sql`INSERT INTO games (code, host_id, config, ruleset_version, status, created_at)
      SELECT 'EXPORT', ${owner}, '{}', 'test', 'ended', timestamp '2026-10-15 12:00:00' - n * interval '1 second' FROM generate_series(0, 100) n`);
    const games = await db.execute<{ id: string }>(sql`SELECT id FROM games WHERE host_id = ${owner} ORDER BY created_at DESC, id DESC`);
    const displaced = games[99]!.id;
    await db.execute(sql`INSERT INTO game_events (game_id, round, phase, type, actor_id, created_at)
      SELECT ${displaced}, 1, 'day', 'chat', ${owner}, timestamp '2026-10-15 13:00:00' + n * interval '1 second' FROM generate_series(0, 1000) n`);
    const options = { ...page, pageSize: 100, eventPageSize: 1000, snapshotAt: new Date("2026-10-16T00:00:00Z") };
    const initial = await getAccountExportPage(db, owner, options);
    await makeGame(owner, "2026-10-16 01:00:00");
    await db.execute(sql`INSERT INTO game_events (game_id, round, phase, type, actor_id, created_at)
      VALUES (${displaced}, 1, 'day', 'late', ${owner}, timestamp '2026-10-16 01:00:00')`);
    const remaining = await getAccountExportPage(db, owner, { ...options, batchGameIds: initial.batchGameIds, eventCursor: parseAccountExportCursor(initial.nextEventCursor) });
    const nextGames = await getAccountExportPage(db, owner, { ...options, gameCursor: parseAccountExportCursor(initial.nextGameCursor) });
    expect(initial.games.flatMap((game) => game.events).length + remaining.games.flatMap((game) => game.events).length).toBe(1001);
    expect(remaining.eventsHasMore).toBe(false);
    expect(nextGames.games.map((game) => game.id)).toEqual([games[100]!.id]);
  });

  it("reauthorizes a frozen batch and fails rather than reporting a partial export as complete", async () => {
    const viewer = await makeUser();
    const host = await makeUser();
    const game = await makeGame(host);
    await db.execute(sql`INSERT INTO game_players (game_id, user_id, display_name, role) VALUES (${game}, ${viewer}, 'Synthetic', 'seer')`);
    const initial = await getAccountExportPage(db, viewer, page);
    await db.execute(sql`DELETE FROM game_players WHERE game_id = ${game} AND user_id = ${viewer}`);
    await expect(getAccountExportPage(db, viewer, { ...page, batchGameIds: initial.batchGameIds })).rejects.toBeInstanceOf(AccountExportChangedError);
  });

  for (const reverse of [false, true]) {
    it(`composes two overlapping account deletions, reverse=${reverse}`, async () => {
      const a = await makeUser();
      const b = await makeUser();
      const host = await makeUser();
      const game = await makeGame(host);
      for (const id of [a, b]) await db.execute(sql`INSERT INTO game_players (game_id, user_id, display_name, role) VALUES (${game}, ${id}, 'Synthetic', 'seer')`);
      const eventId = randomUUID();
      const payload = JSON.stringify({ assignments: [{ userId: a, displayName: "Old A", role: "seer" }, { userId: b, displayName: "Old B", role: "werewolf" }] });
      await db.execute(sql`INSERT INTO game_events (id, game_id, round, phase, type, payload) VALUES (${eventId}, ${game}, 0, 'night', 'start', ${payload}::jsonb)`);
      let unlock!: () => void;
      let locked!: () => void;
      const ready = new Promise<void>((resolve) => { locked = resolve; });
      const release = new Promise<void>((resolve) => { unlock = resolve; });
      const lock = blocker.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM game_events WHERE id = ${eventId} FOR UPDATE`);
        locked();
        await release;
      });
      await ready;
      const pending: Promise<boolean>[] = [];
      try {
        pending.push(deleteUserAccountAtomically(first, reverse ? b : a));
        await waitForLock(names[2]!);
        pending.push(deleteUserAccountAtomically(second, reverse ? a : b));
        await waitForLock(names[3]!);
        unlock();
        expect(await Promise.all(pending)).toEqual([true, true]);
      } finally {
        unlock();
        await Promise.allSettled([lock, ...pending]);
      }
      const result = await db.execute<{ payload: { assignments: Array<Record<string, string>> } }>(sql`SELECT payload FROM game_events WHERE id = ${eventId}`);
      for (const entry of result[0]!.payload.assignments) {
        expect(entry.userId).toMatch(/^deleted_/);
        expect(entry.displayName).toBe("Изтрит играч");
        expect(entry).not.toHaveProperty("role");
      }
      expect(JSON.stringify(result)).not.toContain(a);
      expect(JSON.stringify(result)).not.toContain(b);
    }, 30_000);
  }
});

async function makeUser() {
  const id = `query-test-${randomUUID()}`;
  await db.execute(sql`INSERT INTO "user" (id, name, email) VALUES (${id}, 'Synthetic', ${`${id}@example.invalid`})`);
  users.push(id);
  return id;
}
async function makeGame(owner: string, timestamp = "2026-10-15 00:00:00") {
  const id = randomUUID();
  await db.execute(sql`INSERT INTO games (id, code, host_id, config, ruleset_version, status, created_at)
    VALUES (${id}, 'EXPORT', ${owner}, '{}', 'test', 'ended', ${timestamp}::timestamp)`);
  return id;
}
async function waitForLock(name: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await db.execute<{ waiting: boolean }>(sql`SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE application_name = ${name}`);
    if (rows.some((row) => row.waiting)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Deletion did not reach the controlled row lock");
}
