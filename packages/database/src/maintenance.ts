import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

const DEFAULT_BATCH_SIZE = 1_000;
const DEFAULT_STALE_LOBBY_HOURS = 48;
const DEFAULT_STALE_ACTIVE_HOURS = 24;
const DEFAULT_OAUTH_TOKEN_BATCH_SIZE = 100;

export interface DatabaseMaintenanceOptions {
  now?: Date;
  batchSize?: number;
  staleLobbyHours?: number;
  staleActiveHours?: number;
  eventRetentionDays?: number;
}

export interface DatabaseMaintenanceResult {
  acquired: boolean;
  sessionsDeleted: number;
  verificationsDeleted: number;
  gamesAbandoned: number;
  activeGamesAbandoned: number;
  eventsDeleted: number;
  backlog?: DatabaseMaintenanceBacklog;
}

export interface DatabaseMaintenanceBacklogMetric {
  remainingAtLeast: number;
  batchSaturated: boolean;
  oldestEligibleAt: string | null;
  oldestAgeMs: number | null;
}

export interface DatabaseMaintenanceBacklog {
  expiredSessions: DatabaseMaintenanceBacklogMetric;
  expiredVerifications: DatabaseMaintenanceBacklogMetric;
  staleLobbies: DatabaseMaintenanceBacklogMetric;
  staleActiveGames: DatabaseMaintenanceBacklogMetric;
  expiredEvents: DatabaseMaintenanceBacklogMetric;
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

interface MaintenanceMutationRow extends Record<string, unknown> {
  affected: number;
  remainingAtLeast: number;
  batchSaturated: boolean;
  oldestEligibleAt: string | null;
}

interface MaintenanceMutationResult {
  affected: number;
  backlog: DatabaseMaintenanceBacklogMetric;
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
  const staleActiveCutoff = hoursBefore(
    now,
    boundedPositiveInteger(options.staleActiveHours, DEFAULT_STALE_ACTIVE_HOURS, 24 * 30),
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

    const expiredSessions = await deleteExpiredRows(tx, "session", nowIso, batchSize, now);
    const expiredVerifications = await deleteExpiredRows(
      tx,
      "verification",
      nowIso,
      batchSize,
      now,
    );
    const staleLobbies = maintenanceMutationResult(await tx.execute<MaintenanceMutationRow>(sql`
      WITH candidates AS (
        SELECT "id", "updated_at" AS "eligibleAt"
        FROM "games"
        WHERE "status" = 'lobby' AND "updated_at" < ${staleLobbyCutoff.toISOString()}
        ORDER BY "updated_at", "id"
        LIMIT ${batchSize + 1}
        FOR UPDATE SKIP LOCKED
      ),
      selected AS (
        SELECT "id", "eligibleAt"
        FROM candidates
        ORDER BY "eligibleAt", "id"
        LIMIT ${batchSize}
      ),
      changed AS (
        UPDATE "games"
        SET
          "status" = 'abandoned',
          "ended_at" = COALESCE("games"."ended_at", ${nowIso}),
          "updated_at" = ${nowIso}
        FROM selected
        WHERE "games"."id" = selected."id"
        RETURNING 1
      )
      ${boundedMaintenanceResultProjection(batchSize)}
    `), now);
    const staleActiveGames = maintenanceMutationResult(await tx.execute<MaintenanceMutationRow>(sql`
      WITH candidates AS (
        SELECT "id", "started_at" AS "eligibleAt"
        FROM "games"
        WHERE
          "status" = 'active'
          AND "started_at" IS NOT NULL
          AND "started_at" < ${staleActiveCutoff.toISOString()}
        ORDER BY "started_at", "id"
        LIMIT ${batchSize + 1}
        FOR UPDATE SKIP LOCKED
      ),
      selected AS (
        SELECT "id", "eligibleAt"
        FROM candidates
        ORDER BY "eligibleAt", "id"
        LIMIT ${batchSize}
      ),
      changed AS (
        UPDATE "games"
        SET
          "status" = 'abandoned',
          "ended_at" = COALESCE("games"."ended_at", ${nowIso}),
          "updated_at" = ${nowIso}
        FROM selected
        WHERE "games"."id" = selected."id"
        RETURNING 1
      )
      ${boundedMaintenanceResultProjection(batchSize)} /* active_game_reconciliation */
    `), now);

    const expiredEvents = eventRetentionDays > 0
      ? await deleteExpiredEvents(
          tx,
          new Date(
            now.getTime() - eventRetentionDays * 24 * 60 * 60 * 1_000,
          ).toISOString(),
          batchSize,
          now,
        )
      : emptyMaintenanceMutationResult();

    return {
      acquired: true,
      sessionsDeleted: expiredSessions.affected,
      verificationsDeleted: expiredVerifications.affected,
      gamesAbandoned: staleLobbies.affected,
      activeGamesAbandoned: staleActiveGames.affected,
      eventsDeleted: expiredEvents.affected,
      backlog: {
        expiredSessions: expiredSessions.backlog,
        expiredVerifications: expiredVerifications.backlog,
        staleLobbies: staleLobbies.backlog,
        staleActiveGames: staleActiveGames.backlog,
        expiredEvents: expiredEvents.backlog,
      },
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
  now: Date,
): Promise<MaintenanceMutationResult> {
  const tableName = sql.identifier(table);
  return maintenanceMutationResult(await tx.execute<MaintenanceMutationRow>(sql`
    WITH candidates AS (
      SELECT "id", "expires_at" AS "eligibleAt"
      FROM ${tableName}
      WHERE "expires_at" < ${cutoff}
      ORDER BY "expires_at", "id"
      LIMIT ${batchSize + 1}
      FOR UPDATE SKIP LOCKED
    ),
    selected AS (
      SELECT "id", "eligibleAt"
      FROM candidates
      ORDER BY "eligibleAt", "id"
      LIMIT ${batchSize}
    ),
    changed AS (
      DELETE FROM ${tableName}
      USING selected
      WHERE ${tableName}."id" = selected."id"
      RETURNING 1
    )
    ${boundedMaintenanceResultProjection(batchSize)}
  `), now);
}

async function deleteExpiredEvents(
  tx: MaintenanceTransaction,
  cutoff: string,
  batchSize: number,
  now: Date,
): Promise<MaintenanceMutationResult> {
  // The transaction-level advisory lock already serializes maintenance passes.
  // Avoid FOR UPDATE here so the web maintenance role needs no event UPDATE grant.
  return maintenanceMutationResult(await tx.execute<MaintenanceMutationRow>(sql`
    WITH candidates AS (
      SELECT event."id", event."created_at" AS "eligibleAt"
      FROM "game_events" AS event
      INNER JOIN "games" AS game ON game."id" = event."game_id"
      WHERE
        event."created_at" < ${cutoff}
        AND game."status" IN ('ended', 'abandoned')
      ORDER BY event."created_at", event."id"
      LIMIT ${batchSize + 1}
    ),
    selected AS (
      SELECT "id", "eligibleAt"
      FROM candidates
      ORDER BY "eligibleAt", "id"
      LIMIT ${batchSize}
    ),
    changed AS (
      DELETE FROM "game_events"
      USING selected
      WHERE "game_events"."id" = selected."id"
      RETURNING 1
    )
    ${boundedMaintenanceResultProjection(batchSize)}
  `), now);
}

function boundedMaintenanceResultProjection(batchSize: number) {
  return sql`
    SELECT
      (SELECT COUNT(*)::int FROM changed) AS affected,
      GREATEST(
        (SELECT COUNT(*)::int FROM candidates)
          - (SELECT COUNT(*)::int FROM selected),
        0
      )::int AS "remainingAtLeast",
      (SELECT COUNT(*) FROM candidates) > ${batchSize} AS "batchSaturated",
      (
        SELECT to_char(
          candidate."eligibleAt",
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
        FROM candidates AS candidate
        WHERE NOT EXISTS (
          SELECT 1
          FROM selected
          WHERE selected."id" = candidate."id"
        )
        ORDER BY candidate."eligibleAt", candidate."id"
        LIMIT 1
      ) AS "oldestEligibleAt"
  `;
}

function maintenanceMutationResult(
  rows: MaintenanceMutationRow[],
  now: Date,
): MaintenanceMutationResult {
  const row = rows[0];
  const oldestEligibleAt = normalizeMaintenanceTimestamp(row?.oldestEligibleAt);
  return {
    affected: finiteNonNegativeInteger(row?.affected),
    backlog: {
      remainingAtLeast: finiteNonNegativeInteger(row?.remainingAtLeast),
      batchSaturated: row?.batchSaturated === true,
      oldestEligibleAt,
      oldestAgeMs: oldestEligibleAt === null
        ? null
        : Math.max(0, now.getTime() - Date.parse(oldestEligibleAt)),
    },
  };
}

function normalizeMaintenanceTimestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function finiteNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
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
    activeGamesAbandoned: 0,
    eventsDeleted: 0,
    backlog: {
      expiredSessions: emptyBacklogMetric(),
      expiredVerifications: emptyBacklogMetric(),
      staleLobbies: emptyBacklogMetric(),
      staleActiveGames: emptyBacklogMetric(),
      expiredEvents: emptyBacklogMetric(),
    },
  };
}

function emptyMaintenanceMutationResult(): MaintenanceMutationResult {
  return {
    affected: 0,
    backlog: emptyBacklogMetric(),
  };
}

function emptyBacklogMetric(): DatabaseMaintenanceBacklogMetric {
  return {
    remainingAtLeast: 0,
    batchSaturated: false,
    oldestEligibleAt: null,
    oldestAgeMs: null,
  };
}

function emptyOAuthTokenEncryptionResult(acquired: boolean): OAuthTokenEncryptionResult {
  return {
    acquired,
    accountsUpdated: 0,
    tokensEncrypted: 0,
  };
}
