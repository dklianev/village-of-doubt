import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { gamePlayers } from "./schema.js";

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
