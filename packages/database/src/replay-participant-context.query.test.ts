import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.js";
import { getReplayParticipantContext } from "./queries.js";
import { gameEvents } from "./schema.js";

const dialect = new PgDialect();
function database(rows: unknown[] = []) {
  const limit = vi.fn(async () => rows);
  const orderBy = vi.fn((..._clauses: SQL[]) => ({ limit }));
  const where = vi.fn((_clause: SQL) => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const selectDistinctOn = vi.fn((_columns: unknown, _fields: unknown) => ({ from }));
  return { db: { selectDistinctOn } as unknown as Database, selectDistinctOn, from, where, orderBy, limit };
}

describe("getReplayParticipantContext", () => {
  it.each([{ ids: [] }, { ids: ["", ""] }])("avoids the database for an empty identity set $ids", async ({ ids }) => {
    const q = database();
    expect(await getReplayParticipantContext(q.db, "synthetic-game", ids, "public")).toEqual([]);
    expect(q.selectDistinctOn).not.toHaveBeenCalled();
  });

  it("selects the newest visible join per actor with a deterministic equal-time tie-break", async () => {
    const join = { id: "synthetic-event", type: "player_joined", actorId: "spectator-a", targetId: null,
      payload: { displayName: "Synthetic spectator", spectator: true }, visibility: "public",
      phase: "lobby", round: 0, createdAt: new Date(0) };
    const q = database([join]);
    expect(await getReplayParticipantContext(q.db, "synthetic-game", ["spectator-a", "spectator-b", "spectator-a"], "public"))
      .toEqual([join]);
    expect(q.selectDistinctOn).toHaveBeenCalledWith([gameEvents.actorId], {
      id: gameEvents.id, round: gameEvents.round, phase: gameEvents.phase, type: gameEvents.type,
      actorId: gameEvents.actorId, targetId: gameEvents.targetId, visibility: gameEvents.visibility,
      payload: gameEvents.payload, createdAt: gameEvents.createdAt,
    });
    expect(q.from).toHaveBeenCalledWith(gameEvents);
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["synthetic-game", "player_joined", "spectator-a", "spectator-b", "public"]);
    expect(filter.sql).toContain('"game_events"."actor_id" in');
    expect(filter.sql).toContain('"game_events"."visibility" =');
    expect(q.orderBy.mock.calls[0]!.map(clause => dialect.sqlToQuery(clause).sql)).toEqual([
      '"game_events"."actor_id" asc', '"game_events"."created_at" desc', '"game_events"."id" desc',
    ]);
    expect(q.limit).toHaveBeenCalledWith(2);
  });

  it("still restricts full visibility to join metadata, the requested game and actor IDs", async () => {
    const q = database();
    await getReplayParticipantContext(q.db, "synthetic-game", ["spectator-a"], "all");
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["synthetic-game", "player_joined", "spectator-a"]);
    expect(filter.sql).not.toContain('"visibility"');
    expect(q.limit).toHaveBeenCalledWith(1);
  });

  it("caps the first 400 distinct nonempty IDs without duplicate IDs wasting slots", async () => {
    const q = database();
    const ids = Array.from({ length: 450 }, (_, index) => `synthetic-${index}`);
    await getReplayParticipantContext(q.db, "synthetic-game", ["", ...Array(600).fill(ids[0]), ...ids], "public");
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toEqual(["synthetic-game", "player_joined", ...ids.slice(0, 400), "public"]);
    expect(q.limit).toHaveBeenCalledWith(400);
  });

  it("parameterizes arbitrary actor IDs without treating them as SQL", async () => {
    const q = database();
    const actor = "synthetic-' OR 1=1 --";
    await getReplayParticipantContext(q.db, "synthetic-game", [actor], "public");
    const filter = dialect.sqlToQuery(q.where.mock.calls[0]![0]);
    expect(filter.params).toContain(actor);
    expect(filter.sql).not.toContain(actor);
  });

  it("does not turn database failures into missing identities", async () => {
    const q = database();
    q.limit.mockRejectedValue(new Error("synthetic-unavailable"));
    await expect(getReplayParticipantContext(q.db, "synthetic-game", ["spectator-a"], "public"))
      .rejects.toThrow("synthetic-unavailable");
  });
});
