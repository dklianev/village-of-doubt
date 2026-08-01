import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

const DEFAULT_BATCH_SIZE = 1_000;
const DEFAULT_STALE_LOBBY_HOURS = 48;
const DEFAULT_OAUTH_TOKEN_BATCH_SIZE = 100;

export interface DatabaseMaintenanceOptions {
  now?: Date;
  batchSize?: number;
  staleLobbyHours?: number;
  eventRetentionDays?: number;
}

export interface DatabaseMaintenanceResult {
  acquired: boolean;
  sessionsDeleted: number;
  verificationsDeleted: number;
  gamesAbandoned: number;
  eventsDeleted: number;
}

export interface OAuthTokenEncryptionOptions {
  now?: Date;
  batchSize?: number;
  rewrapToken?: OAuthTokenEncryptor;
}

export interface OAuthTokenEncryptionResult {
  acquired: boolean;
  accountsUpdated: number;
  tokensEncrypted: number;
}

export type OAuthTokenEncryptor = (token: string) => Promise<string>;

type MaintenanceTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface OAuthTokenRow extends Record<string, unknown> {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
}

export async function runDatabaseMaintenance(
  db: Database,
  options: DatabaseMaintenanceOptions = {},
): Promise<DatabaseMaintenanceResult> {
  const now = options.now ?? new Date();
  const batchSize = boundedPositiveInteger(options.batchSize, DEFAULT_BATCH_SIZE, 10_000);
  const staleLobbyCutoff = hoursBefore(
    now,
    boundedPositiveInteger(options.staleLobbyHours, DEFAULT_STALE_LOBBY_HOURS, 24 * 30),
  );
  const eventRetentionDays = Math.max(0, Math.trunc(options.eventRetentionDays ?? 0));
  const nowIso = now.toISOString();

  return db.transaction(async (tx) => {
    const lockRows = await tx.execute<{ acquired: boolean }>(sql`
      SELECT pg_try_advisory_xact_lock(
        hashtextextended('werewolf-database-maintenance', 0::bigint)
      ) AS acquired
    `);
    if (lockRows[0]?.acquired !== true) {
      return emptyResult(false);
    }

    const sessionsDeleted = await deleteExpiredRows(tx, "session", nowIso, batchSize);
    const verificationsDeleted = await deleteExpiredRows(tx, "verification", nowIso, batchSize);
    const gamesAbandoned = affectedCount(await tx.execute(sql`
      WITH candidates AS (
        SELECT "id"
        FROM "games"
        WHERE "status" = 'lobby' AND "updated_at" < ${staleLobbyCutoff.toISOString()}
        ORDER BY "updated_at", "id"
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      ),
      updated AS (
        UPDATE "games"
        SET
          "status" = 'abandoned',
          "ended_at" = COALESCE("games"."ended_at", ${nowIso}),
          "updated_at" = ${nowIso}
        FROM candidates
        WHERE "games"."id" = candidates."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS affected FROM updated
    `));

    const eventsDeleted = eventRetentionDays > 0
      ? await deleteExpiredEvents(
          tx,
          new Date(
            now.getTime() - eventRetentionDays * 24 * 60 * 60 * 1_000,
          ).toISOString(),
          batchSize,
        )
      : 0;

    return {
      acquired: true,
      sessionsDeleted,
      verificationsDeleted,
      gamesAbandoned,
      eventsDeleted,
    };
  });
}

export async function encryptLegacyOAuthTokens(
  db: Database,
  encryptToken: OAuthTokenEncryptor,
  options: OAuthTokenEncryptionOptions = {},
): Promise<OAuthTokenEncryptionResult> {
  const now = options.now ?? new Date();
  const batchSize = boundedPositiveInteger(
    options.batchSize,
    DEFAULT_OAUTH_TOKEN_BATCH_SIZE,
    1_000,
  );

  return db.transaction(async (tx) => {
    const lockRows = await tx.execute<{ acquired: boolean }>(sql`
      SELECT pg_try_advisory_xact_lock(
        hashtextextended('werewolf-oauth-token-encryption', 0::bigint)
      ) AS acquired
    `);
    if (lockRows[0]?.acquired !== true) {
      return emptyOAuthTokenEncryptionResult(false);
    }

    const rows = await tx.execute<OAuthTokenRow>(sql`
      SELECT
        "id",
        "access_token" AS "accessToken",
        "refresh_token" AS "refreshToken",
        "id_token" AS "idToken"
      FROM "account"
      WHERE
        ${oauthTokenNeedsMigration(sql.identifier("access_token"), Boolean(options.rewrapToken))}
        OR ${oauthTokenNeedsMigration(sql.identifier("refresh_token"), Boolean(options.rewrapToken))}
        OR ${oauthTokenNeedsMigration(sql.identifier("id_token"), Boolean(options.rewrapToken))}
      ORDER BY "updated_at", "id"
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `);

    if (rows.length === 0) {
      return emptyOAuthTokenEncryptionResult(true);
    }

    let tokensEncrypted = 0;
    const encryptedRows = await Promise.all(rows.map(async (row) => {
      const encryptIfLegacy = async (token: string | null) => {
        if (!token || token.startsWith("$ba$")) {
          return token;
        }
        if (isBareHexToken(token)) {
          if (!options.rewrapToken) {
            return token;
          }
          tokensEncrypted += 1;
          return options.rewrapToken(token);
        }
        tokensEncrypted += 1;
        return encryptToken(token);
      };

      return {
        id: row.id,
        accessToken: await encryptIfLegacy(row.accessToken),
        refreshToken: await encryptIfLegacy(row.refreshToken),
        idToken: await encryptIfLegacy(row.idToken),
      };
    }));

    const values = encryptedRows.map((row) => sql`
      (
        ${row.id},
        ${row.accessToken},
        ${row.refreshToken},
        ${row.idToken}
      )
    `);
    const accountsUpdated = affectedCount(await tx.execute(sql`
      WITH encrypted (
        "id",
        "access_token",
        "refresh_token",
        "id_token"
      ) AS (
        VALUES ${sql.join(values, sql`, `)}
      ),
      updated AS (
        UPDATE "account" AS account
        SET
          "access_token" = encrypted."access_token",
          "refresh_token" = encrypted."refresh_token",
          "id_token" = encrypted."id_token",
          "updated_at" = ${now.toISOString()}
        FROM encrypted
        WHERE account."id" = encrypted."id"
        RETURNING 1
      )
      SELECT COUNT(*)::int AS affected FROM updated
    `));

    return {
      acquired: true,
      accountsUpdated,
      tokensEncrypted,
    };
  });
}

export async function countUnversionedOAuthTokens(db: Database): Promise<number> {
  const rows = await db.execute<{ affected: number }>(sql`
    SELECT COUNT(*)::int AS affected
    FROM (
      SELECT "access_token" AS token FROM "account"
      UNION ALL
      SELECT "refresh_token" AS token FROM "account"
      UNION ALL
      SELECT "id_token" AS token FROM "account"
    ) AS oauth_tokens
    WHERE token IS NOT NULL
      AND token NOT LIKE '$ba$%'
  `);
  return affectedCount(rows);
}

async function deleteExpiredRows(
  tx: MaintenanceTransaction,
  table: "session" | "verification",
  cutoff: string,
  batchSize: number,
): Promise<number> {
  const tableName = sql.identifier(table);
  return affectedCount(await tx.execute(sql`
    WITH candidates AS (
      SELECT "id"
      FROM ${tableName}
      WHERE "expires_at" < ${cutoff}
      ORDER BY "expires_at", "id"
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    ),
    deleted AS (
      DELETE FROM ${tableName}
      USING candidates
      WHERE ${tableName}."id" = candidates."id"
      RETURNING 1
    )
    SELECT COUNT(*)::int AS affected FROM deleted
  `));
}

async function deleteExpiredEvents(
  tx: MaintenanceTransaction,
  cutoff: string,
  batchSize: number,
): Promise<number> {
  return affectedCount(await tx.execute(sql`
    WITH candidates AS (
      SELECT event."id"
      FROM "game_events" AS event
      INNER JOIN "games" AS game ON game."id" = event."game_id"
      WHERE
        event."created_at" < ${cutoff}
        AND game."status" IN ('ended', 'abandoned')
      ORDER BY event."created_at", event."id"
      LIMIT ${batchSize}
      FOR UPDATE OF event SKIP LOCKED
    ),
    deleted AS (
      DELETE FROM "game_events"
      USING candidates
      WHERE "game_events"."id" = candidates."id"
      RETURNING 1
    )
    SELECT COUNT(*)::int AS affected FROM deleted
  `));
}

function affectedCount(rows: Array<Record<string, unknown>>): number {
  const value = rows[0]?.affected;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boundedPositiveInteger(value: number | undefined, fallback: number, maximum: number) {
  const candidate = Math.trunc(value ?? fallback);
  return Number.isFinite(candidate) && candidate > 0 ? Math.min(candidate, maximum) : fallback;
}

function hoursBefore(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1_000);
}

function oauthTokenNeedsMigration(column: ReturnType<typeof sql.identifier>, includeBareHex: boolean) {
  if (includeBareHex) {
    return sql`${column} IS NOT NULL AND ${column} NOT LIKE '$ba$%'`;
  }
  return sql`
    ${column} IS NOT NULL
    AND NOT (
      ${column} LIKE '$ba$%'
      OR (
        length(${column}) % 2 = 0
        AND ${column} ~ '^[0-9a-fA-F]+$'
      )
    )
  `;
}

function isBareHexToken(token: string) {
  return token.length % 2 === 0 && /^[0-9a-f]+$/i.test(token);
}

function emptyResult(acquired: boolean): DatabaseMaintenanceResult {
  return {
    acquired,
    sessionsDeleted: 0,
    verificationsDeleted: 0,
    gamesAbandoned: 0,
    eventsDeleted: 0,
  };
}

function emptyOAuthTokenEncryptionResult(acquired: boolean): OAuthTokenEncryptionResult {
  return {
    acquired,
    accountsUpdated: 0,
    tokensEncrypted: 0,
  };
}
