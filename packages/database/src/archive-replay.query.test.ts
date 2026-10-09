import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.js";
import { DELETED_DISPLAY_NAME, GameTimelineCursorExpiredError, getGameReplayAchievements, getGameReplayParticipants,
  getGameTimeline, getLeaderboardRows, getPlayerRolesInGames, getPublicGameArchive, getReplayEligibleGameIds,
  type GameReplayParticipantRow } from "./queries.js";
import { gamePlayers, games, user, userAchievements } from "./schema.js";

const dialect = new PgDialect();
const id = "00000000-0000-4000-8000-000000000001";
const secondId = "00000000-0000-4000-8000-000000000002";
function database(rows: unknown[] = [], counts: unknown[] = []) {
  const limit = vi.fn(async (_count: number) => rows);
  const orderBy = vi.fn((..._clauses: SQL[]) => ({ limit }));
  const groupBy = vi.fn(async () => counts);
  const where = vi.fn((_clause: SQL) => ({ orderBy, groupBy, limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn((_fields: unknown) => ({ from }));
  return { db: { select } as unknown as Database, select, where, orderBy, limit, groupBy };
}

describe("public archive queries", () => {
  it("filters the entire public ended archive before limiting and counts public events only on returned games", async () => {
    const q = database([{ id }, { id: secondId }], [{ gameId: id, value: 4 }]);
    const result = await getPublicGameArchive(q.db, { family: "mafia", outcome: "village", limit: 1 });
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["ended", "public", "village"]);
    expect(filter.sql).toContain("IN ('mafia_free', 'mafia_sport')");
    expect(filter.sql).toContain('"games"."winner_team" =');
    expect(q.limit).toHaveBeenCalledWith(2);
    expect(result).toEqual({ games: [{ id, eventCount: 4 }], hasOlder: true, hasNewer: false });
    const eventFilter = dialect.sqlToQuery(q.where.mock.calls[1]![0]);
    expect(eventFilter.params).toEqual([id, "public"]);
    expect(eventFilter.params).not.toContain(secondId);
  });

  it("supports the other family and absent winners without conflating result and game mode", async () => {
    const q = database();
    await getPublicGameArchive(q.db, { family: "werewolves", outcome: "unknown" });
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.sql).toContain("= 'werewolves_classic'");
    expect(filter.sql).toContain('"games"."winner_team" is null');
    expect(q.select).toHaveBeenCalledTimes(1);
  });

  it.each(["before", "after"] as const)("uses a precise, public-only %s keyset anchor with a UUID tie-break", async (direction) => {
    const q = database([{ id: secondId }, { id }]);
    const result = await getPublicGameArchive(q.db, { [direction]: id, limit: 2 });
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["ended", "public", "ended", "public", id]);
    expect(filter.sql.match(/"games"\."status" =/g)).toHaveLength(2);
    expect(filter.sql.match(/"games"\."room_visibility" =/g)).toHaveLength(2);
    expect(filter.sql).toContain('COALESCE("games"."ended_at", \'-infinity\'::timestamp), "games"."id"');
    expect(filter.sql).toContain(direction === "before" ? " < " : " > ");
    const order = q.orderBy.mock.calls[0]!.map((clause) => dialect.sqlToQuery(clause).sql);
    expect(order).toEqual(direction === "before"
      ? ['"games"."ended_at" DESC NULLS LAST', '"games"."id" desc']
      : ['"games"."ended_at" ASC NULLS FIRST', '"games"."id" asc']);
    expect(result.games.map((game) => game.id)).toEqual(direction === "before" ? [secondId, id] : [id, secondId]);
    expect(result.hasOlder).toBe(direction === "after");
    expect(result.hasNewer).toBe(direction === "before");
  });

  it.each(["before", "after"] as const)("requires the %s anchor to match both independent filters", async (direction) => {
    const q = database();
    expect(await getPublicGameArchive(q.db, { family: "mafia", outcome: "village", [direction]: id }))
      .toEqual({ games: [], hasOlder: false, hasNewer: false });
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["ended", "public", "village", "ended", "public", "village", id]);
    expect(filter.sql.match(/IN \('mafia_free', 'mafia_sport'\)/g)).toHaveLength(2);
    expect(filter.sql.match(/"games"\."winner_team" =/g)).toHaveLength(2);
  });

  it("also scopes unknown outcomes and the default werewolf family inside the anchor", async () => {
    const q = database();
    await getPublicGameArchive(q.db, { family: "werewolves", outcome: "unknown", before: id });
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.sql.match(/COALESCE\("games"\."config"->>'mode', 'werewolves_classic'\)/g)).toHaveLength(2);
    expect(filter.sql.match(/"games"\."winner_team" is null/g)).toHaveLength(2);
  });

  it.each([[0, 2], [-10, 2], [3.9, 4], [200, 101], [NaN, 13], [Infinity, 13]])("bounds limit %s including one lookahead", async (requested, expected) => {
    const q = database();
    await getPublicGameArchive(q.db, { limit: requested });
    expect(q.limit).toHaveBeenCalledWith(expected);
  });

  it("rejects malformed or conflicting cursors before querying", async () => {
    const q = database();
    await expect(getPublicGameArchive(q.db, { before: "not-a-uuid" })).rejects.toThrow(RangeError);
    await expect(getPublicGameArchive(q.db, { before: id, after: secondId })).rejects.toThrow(RangeError);
    expect(q.select).not.toHaveBeenCalled();
  });
});

describe("replay continuation", () => {
  it("preserves public scope and exact stored timestamp precision for a lookahead page", async () => {
    const q = database([{ id }]);
    const createdAt = new Date("2026-09-17T12:00:00.123Z");
    await getGameTimeline(q.db, "game-1", 201, { order: "asc", visibilityFilter: "public", after: { id, createdAt } });
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["game-1", "public", "game-1", "public", id, id]);
    expect(filter.sql).toContain('SELECT "game_events"."created_at" FROM "game_events"');
    expect(filter.sql.match(/"game_events"\."visibility" =/g)).toHaveLength(2);
    expect(filter.sql).not.toContain("COALESCE");
    expect(filter.sql).toContain('("game_events"."created_at", "game_events"."id") >');
    expect(q.orderBy.mock.calls[0]!.map((clause) => dialect.sqlToQuery(clause).sql))
      .toEqual(['"game_events"."created_at" asc', '"game_events"."id" asc']);
    expect(q.limit).toHaveBeenCalledWith(201);
    expect(q.select).toHaveBeenCalledOnce();
  });

  it("uses chronological order when an after cursor omits order", async () => {
    const q = database([{ id }]);
    await getGameTimeline(q.db, "game-1", 50, { after: { id, createdAt: new Date(0) } });
    expect(dialect.sqlToQuery(q.orderBy.mock.calls[0]![0]!).sql).toContain("asc");
  });

  it.each(["all", "public"] as const)("expires missing or inaccessible %s anchors instead of falling back to a rounded timestamp", async (visibilityFilter) => {
    const q = database();
    await expect(getGameTimeline(q.db, "game-1", 50, { visibilityFilter, after: { id, createdAt: new Date(0) } }))
      .rejects.toThrow(GameTimelineCursorExpiredError);
    expect(q.select).toHaveBeenCalledTimes(2);
    const anchor = dialect.sqlToQuery(q.where.mock.calls[1]![0]);
    expect(anchor.params).toEqual(visibilityFilter === "public" ? ["game-1", "public", id] : ["game-1", id]);
    expect(q.limit.mock.calls.map((call) => call[0])).toEqual([50, 1]);
  });

  it("distinguishes the end of a valid replay from a deleted anchor", async () => {
    const q = database();
    q.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id }]);
    await expect(getGameTimeline(q.db, "game-1", 50, { after: { id, createdAt: new Date(0) } })).resolves.toEqual([]);
    expect(q.select).toHaveBeenCalledTimes(2);
  });

  it("rejects incompatible order, invalid date and malformed ID without querying", async () => {
    const q = database();
    await expect(getGameTimeline(q.db, "game-1", 100, { order: "desc", after: { id, createdAt: new Date(0) } })).rejects.toThrow(RangeError);
    await expect(getGameTimeline(q.db, "game-1", 100, { after: { id, createdAt: new Date(NaN) } })).rejects.toThrow(RangeError);
    await expect(getGameTimeline(q.db, "game-1", 100, { after: { id: "invalid", createdAt: new Date(0) } })).rejects.toThrow(RangeError);
    expect(q.select).not.toHaveBeenCalled();
  });
});

describe("replay roster portraits and survival", () => {
  function rosterDatabase(rows: unknown[]) {
    const where = vi.fn(async (_condition: SQL) => rows);
    const innerJoin = vi.fn((_table: unknown, _condition: SQL) => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn((_fields: unknown) => ({ from }));
    return { db: { select } as unknown as Database, select, from, innerJoin, where };
  }

  it.each([false, true])("selects public persisted portraits and survival with includeRoles=%s", async (includeRoles) => {
    const participants = [
      { userId: "synthetic-survivor", displayName: "Synthetic survivor", avatarId: "portrait-f03", isAlive: true },
      { userId: "synthetic-eliminated", displayName: "Synthetic eliminated", avatarId: "portrait-m04", isAlive: false },
      { userId: "deleted_synthetic", displayName: DELETED_DISPLAY_NAME, avatarId: "portrait-m01", isAlive: false },
    ];
    const rows = includeRoles ? participants.map((row) => ({ ...row, role: "villager" })) : participants;
    const q = rosterDatabase(rows);

    expect(await getGameReplayParticipants(q.db, id, { includeRoles }))
      .toEqual(participants.map((row) => ({ ...row, role: includeRoles ? "villager" : null })));
    expect(q.select).toHaveBeenCalledExactlyOnceWith({
      userId: gamePlayers.userId,
      displayName: gamePlayers.displayName,
      avatarId: user.avatarId,
      isAlive: gamePlayers.isAlive,
      ...(includeRoles ? { role: gamePlayers.role } : {}),
    });
    expect(q.from).toHaveBeenCalledExactlyOnceWith(gamePlayers);
    expect(q.innerJoin).toHaveBeenCalledExactlyOnceWith(user, expect.anything());
    expect(dialect.sqlToQuery(q.innerJoin.mock.calls[0]![1]).sql)
      .toBe('"user"."id" = "game_players"."user_id"');
    expect(q.where).toHaveBeenCalledOnce();
    expect(dialect.sqlToQuery(q.where.mock.calls[0]![0]))
      .toMatchObject({ sql: '"game_players"."game_id" = $1', params: [id] });
  });

  it.each([false, true])("keeps missing legacy portrait and survival fields unknown with includeRoles=%s", async (includeRoles) => {
    const legacy: GameReplayParticipantRow = {
      userId: "synthetic-legacy", displayName: "Synthetic legacy", role: includeRoles ? "villager" : null,
    };
    const q = rosterDatabase([legacy]);
    const [participant] = await getGameReplayParticipants(q.db, id, { includeRoles });

    expect(participant).toEqual(legacy);
    expect(participant).not.toHaveProperty("avatarId");
    expect(participant).not.toHaveProperty("isAlive");
  });
});

describe("achievement replay eligibility", () => {
  it("batches completed participant games, including private games, without selecting roles", async () => {
    const where = vi.fn(async (_condition: SQL) => [{ gameId: id }, { gameId: secondId }]);
    const innerJoin = vi.fn((_table: unknown, _condition: SQL) => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    expect(await getReplayEligibleGameIds({ select } as unknown as Database, "viewer", [id, secondId, id]))
      .toEqual(new Set([id, secondId]));
    expect(select).toHaveBeenCalledExactlyOnceWith({ gameId: gamePlayers.gameId });
    expect(from).toHaveBeenCalledWith(gamePlayers);
    expect(innerJoin).toHaveBeenCalledWith(games, expect.anything());
    const filter = dialect.sqlToQuery(where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["viewer", id, secondId, "ended"]);
    expect(filter.sql).toContain('"games"."ended_at" is not null');
    expect(filter.sql).not.toContain("room_visibility");
    expect(filter.sql).not.toContain("host_id");
  });

  it("does not query for an absent user or empty set of award games", async () => {
    const q = database();
    expect(await getReplayEligibleGameIds(q.db, "viewer", [])).toEqual(new Set());
    expect(await getReplayEligibleGameIds(q.db, "", [id])).toEqual(new Set());
    expect(q.select).not.toHaveBeenCalled();
  });

  it("leaves existing role lookup semantics independent of game status and endedAt", async () => {
    const where = vi.fn(async (_condition: SQL) => [{ gameId: id, role: "jester" }]);
    const select = vi.fn(() => ({ from: () => ({ where }) }));
    expect(await getPlayerRolesInGames({ select } as unknown as Database, "viewer", [id])).toEqual(new Map([[id, "jester"]]));
    expect(select).toHaveBeenCalledWith({ gameId: gamePlayers.gameId, role: gamePlayers.role });
    expect(dialect.sqlToQuery(where.mock.calls[0]![0]).params).toEqual(["viewer", id]);
  });
});

it("returns only distinct persisted replay award IDs, without player identities", async () => {
  const orderBy = vi.fn(async () => [{ achievementId: "guardian_save" }]);
  const where = vi.fn((_clause: SQL) => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const selectDistinct = vi.fn(() => ({ from }));
  expect(await getGameReplayAchievements({ selectDistinct } as unknown as Database, id)).toEqual(["guardian_save"]);
  expect(selectDistinct).toHaveBeenCalledWith({ achievementId: userAchievements.achievementId });
  expect(dialect.sqlToQuery(where.mock.calls[0]![0]).params).toEqual([id]);
});

it("finishes leaderboard ties with a deterministic user ID", async () => {
  const orderBy = vi.fn((..._clauses: SQL[]) => ({ limit: async () => [] }));
  const query = { innerJoin: () => query, where: () => query, groupBy: () => ({ orderBy }) };
  const db = { select: () => ({ from: () => query }) } as unknown as Database;
  await getLeaderboardRows(db);
  expect(dialect.sqlToQuery(sql.join(orderBy.mock.calls[0]!, sql`, `)).sql).toMatch(/"game_players"\."user_id" asc$/);
});
