import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  avatarId: text("avatar_id").default("portrait-m01").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deletedUserIdentities = pgTable("deleted_user_identities", {
  originalUserId: text("original_user_id").primaryKey(),
  anonymousUserId: text("anonymous_user_id").notNull().unique(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_expires_at_idx").on(table.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    hostId: text("host_id")
      .notNull()
      .references(() => user.id),
    config: jsonb("config").notNull(),
    rulesetVersion: text("ruleset_version").notNull(),
    roomVisibility: text("room_visibility", { enum: ["private", "public"] })
      .notNull()
      .default("private"),
    status: text("status", { enum: ["lobby", "active", "ended", "abandoned"] }).notNull().default("lobby"),
    winnerTeam: text("winner_team", {
      enum: ["village", "werewolves", "vampires", "mafia", "maniac", "lovers", "draw"],
    }),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("games_code_idx").on(table.code),
    index("games_host_id_idx").on(table.hostId),
    index("games_status_idx").on(table.status),
    index("games_status_ended_at_idx").on(table.status, table.endedAt.desc()),
    index("games_visibility_status_ended_at_idx").on(
      table.roomVisibility,
      table.status,
      table.endedAt.desc(),
    ),
    index("games_status_updated_at_idx").on(table.status, table.updatedAt),
    check("games_room_visibility_check", sql`${table.roomVisibility} IN ('private', 'public')`),
    check("games_status_check", sql`${table.status} IN ('lobby', 'active', 'ended', 'abandoned')`),
    check(
      "games_winner_team_check",
      sql`${table.winnerTeam} IS NULL OR ${table.winnerTeam} IN ('village', 'werewolves', 'vampires', 'mafia', 'maniac', 'lovers', 'draw')`,
    ),
  ],
);

export const gamePlayers = pgTable(
  "game_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    isAlive: boolean("is_alive").default(true).notNull(),
    deathRound: integer("death_round"),
    deathCause: text("death_cause"),
    isLover: boolean("is_lover").default(false).notNull(),
    loverUserId: text("lover_user_id"),
    won: boolean("won").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("game_players_game_user_idx").on(table.gameId, table.userId),
    index("game_players_game_id_idx").on(table.gameId),
    index("game_players_user_id_idx").on(table.userId),
    index("game_players_lover_user_id_idx")
      .on(table.loverUserId)
      .where(sql`${table.loverUserId} IS NOT NULL`),
    check(
      "game_players_death_round_check",
      sql`${table.deathRound} IS NULL OR ${table.deathRound} >= 0`,
    ),
  ],
);

export const gameEvents = pgTable(
  "game_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    phase: text("phase").notNull(),
    type: text("type").notNull(),
    actorId: text("actor_id").references(() => user.id),
    targetId: text("target_id").references(() => user.id),
    visibility: text("visibility", { enum: ["public", "private", "faction", "moderator"] })
      .notNull()
      .default("public"),
    payload: jsonb("payload").default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("game_events_game_id_idx").on(table.gameId),
    index("game_events_created_at_idx").on(table.createdAt),
    index("game_events_game_id_created_at_idx").on(table.gameId, table.createdAt.desc()),
    index("game_events_actor_id_idx")
      .on(table.actorId)
      .where(sql`${table.actorId} IS NOT NULL`),
    index("game_events_target_id_idx")
      .on(table.targetId)
      .where(sql`${table.targetId} IS NOT NULL`),
    check(
      "game_events_visibility_check",
      sql`${table.visibility} IN ('public', 'private', 'faction', 'moderator')`,
    ),
    check("game_events_round_check", sql`${table.round} >= 0`),
  ],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_achievements_user_achievement_idx").on(table.userId, table.achievementId),
    index("user_achievements_user_id_idx").on(table.userId),
    index("user_achievements_user_id_unlocked_at_idx").on(table.userId, table.unlockedAt.desc()),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  hostedGames: many(games),
  gamePlayers: many(gamePlayers),
  achievements: many(userAchievements),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  host: one(user, { fields: [games.hostId], references: [user.id] }),
  players: many(gamePlayers),
  events: many(gameEvents),
  achievements: many(userAchievements),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, { fields: [gamePlayers.gameId], references: [games.id] }),
  user: one(user, { fields: [gamePlayers.userId], references: [user.id] }),
}));

export const gameEventsRelations = relations(gameEvents, ({ one }) => ({
  game: one(games, { fields: [gameEvents.gameId], references: [games.id] }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(user, { fields: [userAchievements.userId], references: [user.id] }),
  game: one(games, { fields: [userAchievements.gameId], references: [games.id] }),
}));
