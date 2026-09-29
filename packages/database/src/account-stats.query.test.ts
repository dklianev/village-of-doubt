import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.js";
import { getPlayerGameStatistics, getRecentCompletedGamesForUser } from "./queries.js";
import { gamePlayers, games } from "./schema.js";

describe("getPlayerGameStatistics", () => {
  it("aggregates all completed participation with authoritative wins and a deterministic lifetime streak", async () => {
    const summary = { totalGames: 240, totalWins: 167, longestStreak: 64, winsByRole: [] };
    const execute = vi.fn(async (_query: SQL) => [summary]);

    expect(await getPlayerGameStatistics({ execute } as unknown as Database, "synthetic-player")).toBe(summary);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]!);
    expect(query.params).toEqual(["synthetic-player"]);
    expect(query.sql).not.toContain("synthetic-player");
    expect(query.sql).toContain('FROM "game_players"');
    expect(query.sql).toContain('INNER JOIN "games" ON "games"."id" = "game_players"."game_id"');
    expect(query.sql).toContain('WHERE "game_players"."user_id" = $1 AND "games"."status" = \'ended\'');
    expect(query.sql).toContain('"game_players"."won" AS won');
    expect(query.sql).toContain("FILTER (WHERE NOT won)");
    expect(query.sql).toContain("ORDER BY ended_at ASC NULLS FIRST, id ASC ROWS UNBOUNDED PRECEDING");
    expect(query.sql).toContain("FROM streaks WHERE won GROUP BY loss_group");
    expect(query.sql).toContain('COALESCE((SELECT MAX(length) FROM winning_streaks), 0)::int AS "longestStreak"');
    expect(query.sql).toContain("FROM completed_games WHERE won GROUP BY role, winner_team");
    expect(query.sql).not.toMatch(/\bLIMIT\b|host_id|game_events|display_name|deleted_user_identities|room_visibility/i);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does not turn database failure into an empty successful history", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("synthetic-unavailable"));
    await expect(getPlayerGameStatistics({ execute } as unknown as Database, "synthetic-player"))
      .rejects.toThrow("synthetic-unavailable");
  });
});

describe("getRecentCompletedGamesForUser", () => {
  function queryDatabase() {
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn((..._clauses: SQL[]) => ({ limit }));
    const where = vi.fn((_condition: SQL) => ({ orderBy }));
    const innerJoin = vi.fn((_table: unknown, _condition: SQL) => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as Database, select, from, innerJoin, where, orderBy, limit };
  }

  it("filters participants and completed games before its independent limit without loading identities or events", async () => {
    const { db, select, from, innerJoin, where, orderBy, limit } = queryDatabase();
    await getRecentCompletedGamesForUser(db, "synthetic-player");

    expect(select).toHaveBeenCalledWith({
      id: games.id, config: games.config, winnerTeam: games.winnerTeam, endedAt: games.endedAt,
    });
    expect(from).toHaveBeenCalledWith(gamePlayers);
    expect(innerJoin.mock.calls[0]![0]).toBe(games);
    const dialect = new PgDialect();
    const filter = dialect.sqlToQuery(where.mock.calls[0]![0]!);
    expect(filter.sql).toBe('("game_players"."user_id" = $1 and "games"."status" = $2)');
    expect(filter.params).toEqual(["synthetic-player", "ended"]);
    expect(orderBy.mock.calls[0]!.map((clause) => dialect.sqlToQuery(clause).sql)).toEqual([
      '"games"."ended_at" DESC NULLS LAST', '"games"."id" desc',
    ]);
    expect(limit).toHaveBeenCalledWith(3);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it.each([[0, 1], [-2, 1], [3.9, 3], [200, 100], [NaN, 3], [Infinity, 3]])(
    "bounds requested recent limit %s to %s", async (requested, expected) => {
      const { db, limit } = queryDatabase();
      await getRecentCompletedGamesForUser(db, "synthetic-player", requested);
      expect(limit).toHaveBeenCalledWith(expected);
    },
  );
});
