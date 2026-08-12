import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { gameEvents, gamePlayers, gameSessionRevocations, games, session } from "./schema.js";

describe("game_players final outcome schema", () => {
  it("keeps won authoritative, non-null, and false by default", () => {
    const won = getTableConfig(gamePlayers).columns.find((column) => column.name === "won");

    expect(won).toMatchObject({ notNull: true, hasDefault: true, default: false });
  });

  it("adds won through the append-only 0007 migration", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "drizzle/0007_cuddly_felicia_hardy.sql"),
      "utf8",
    );

    expect(migration).toContain(
      'ALTER TABLE "game_players" ADD COLUMN "won" boolean DEFAULT false NOT NULL;',
    );
    expect(migration).toContain('UPDATE "game_players" AS player');
    expect(migration).toContain("game.\"winner_team\" = 'village'");
    expect(migration).not.toContain("game.\"winner_team\" = 'lovers'");
  });
});

describe("database integrity and anonymization indexes", () => {
  it("stores one durable game-session revocation marker per user", () => {
    const config = getTableConfig(gameSessionRevocations);

    expect(config.columns.find((column) => column.name === "user_id")).toMatchObject({
      primary: true,
      notNull: true,
    });
    expect(config.columns.find((column) => column.name === "revoked_at")).toMatchObject({
      notNull: true,
    });
  });

  it("materializes room visibility for archive authorization", () => {
    const roomVisibility = getTableConfig(games).columns.find((column) => column.name === "room_visibility");
    const gameChecks = getTableConfig(games).checks.map((item) => item.name);
    const migration = readFileSync(
      resolve(process.cwd(), "drizzle/0009_certain_iron_man.sql"),
      "utf8",
    );

    expect(roomVisibility).toMatchObject({ notNull: true, hasDefault: true, default: "private" });
    expect(gameChecks).toContain("games_room_visibility_check");
    expect(migration).toContain(
      'ALTER TABLE "games" ADD COLUMN "room_visibility" text DEFAULT \'private\' NOT NULL;',
    );
    expect(migration).toContain('CREATE INDEX "games_visibility_status_ended_at_idx"');
    expect(migration).toContain('"room_visibility" IN (\'private\', \'public\')');
  });

  it("indexes nullable identity references used by account deletion", () => {
    const eventIndexes = getTableConfig(gameEvents).indexes.map((item) => item.config.name);
    const playerIndexes = getTableConfig(gamePlayers).indexes.map((item) => item.config.name);

    expect(eventIndexes).toContain("game_events_actor_id_idx");
    expect(eventIndexes).toContain("game_events_target_id_idx");
    expect(playerIndexes).toContain("game_players_lover_user_id_idx");
  });

  it("indexes lifecycle cleanup predicates", () => {
    const sessionIndexes = getTableConfig(session).indexes.map((item) => item.config.name);
    const gameIndexes = getTableConfig(games).indexes.map((item) => item.config.name);

    expect(sessionIndexes).toContain("session_expires_at_idx");
    expect(gameIndexes).toContain("games_status_updated_at_idx");
  });

  it("keeps stable game and event enums behind database checks", () => {
    const gameChecks = getTableConfig(games).checks.map((item) => item.name);
    const eventChecks = getTableConfig(gameEvents).checks.map((item) => item.name);

    expect(gameChecks).toContain("games_status_check");
    expect(gameChecks).toContain("games_winner_team_check");
    expect(eventChecks).toContain("game_events_visibility_check");
    expect(eventChecks).toContain("game_events_round_check");
  });
});
