import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const CONTEXT = "account-export:v2";
const DEFAULT_TTL_SECONDS = 20 * 60;

type ContinuationPayload = {
  version: 2;
  userId: string;
  exportId: string;
  expiresAt: number;
  snapshotAt: string;
  batch?: { gameIds: string[]; gameCursor: string | null; pageSize: number };
};

export function createAccountExportContinuation(
  userId: string,
  secret: string,
  options: {
    nowSeconds?: number; ttlSeconds?: number; exportId?: string;
    snapshotAt?: string; expiresAt?: number; batch?: ContinuationPayload["batch"];
  } = {},
) {
  assertSecret(secret);
  const payload: ContinuationPayload = {
    version: 2,
    userId,
    exportId: options.exportId ?? randomUUID(),
    expiresAt: options.expiresAt ?? (options.nowSeconds ?? Math.floor(Date.now() / 1_000))
      + (options.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    snapshotAt: options.snapshotAt ?? new Date((options.nowSeconds ?? Date.now() / 1_000) * 1_000).toISOString(),
    ...(options.batch ? { batch: options.batch } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyAccountExportContinuation(
  token: string,
  expectedUserId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): Pick<ContinuationPayload, "exportId" | "expiresAt" | "snapshotAt" | "batch"> | null {
  try {
    assertSecret(secret);
    if (token.length > 8_192) return null;
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }
    const [encoded, signature] = parts as [string, string];
    if (!safeEqual(signature, sign(encoded, secret))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<ContinuationPayload>;
    if (
      payload.version !== 2
      || payload.userId !== expectedUserId
      || typeof payload.exportId !== "string"
      || !/^[a-zA-Z0-9-]{1,128}$/.test(payload.exportId)
      || typeof payload.expiresAt !== "number"
      || !Number.isSafeInteger(payload.expiresAt)
      || payload.expiresAt < nowSeconds
      || typeof payload.snapshotAt !== "string"
      || !Number.isFinite(Date.parse(payload.snapshotAt))
      || new Date(payload.snapshotAt).toISOString() !== payload.snapshotAt
      || (payload.batch !== undefined && !validBatch(payload.batch))
    ) {
      return null;
    }
    return { exportId: payload.exportId, expiresAt: payload.expiresAt, snapshotAt: payload.snapshotAt,
      ...(payload.batch ? { batch: payload.batch } : {}) };
  } catch {
    return null;
  }
}

function validBatch(batch: NonNullable<ContinuationPayload["batch"]>) {
  return batch && Array.isArray(batch.gameIds) && batch.gameIds.length > 0 && batch.gameIds.length <= 100
    && batch.gameIds.every((id) => typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    && new Set(batch.gameIds).size === batch.gameIds.length
    && (batch.gameCursor === null || (typeof batch.gameCursor === "string" && batch.gameCursor.length <= 80))
    && Number.isInteger(batch.pageSize) && batch.pageSize >= batch.gameIds.length && batch.pageSize <= 100;
}

function sign(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(`${CONTEXT}:${encoded}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("GAME_TOKEN_SECRET трябва да бъде поне 32 символа.");
  }
}
