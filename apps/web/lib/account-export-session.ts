import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const CONTEXT = "account-export:v1";
const DEFAULT_TTL_SECONDS = 20 * 60;

type ContinuationPayload = {
  version: 1;
  userId: string;
  exportId: string;
  expiresAt: number;
};

export function createAccountExportContinuation(
  userId: string,
  secret: string,
  options: { nowSeconds?: number; ttlSeconds?: number; exportId?: string } = {},
) {
  assertSecret(secret);
  const payload: ContinuationPayload = {
    version: 1,
    userId,
    exportId: options.exportId ?? randomUUID(),
    expiresAt: (options.nowSeconds ?? Math.floor(Date.now() / 1_000))
      + (options.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyAccountExportContinuation(
  token: string,
  expectedUserId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): { exportId: string; expiresAt: number } | null {
  try {
    assertSecret(secret);
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
      payload.version !== 1
      || payload.userId !== expectedUserId
      || typeof payload.exportId !== "string"
      || !/^[a-zA-Z0-9-]{1,128}$/.test(payload.exportId)
      || typeof payload.expiresAt !== "number"
      || !Number.isSafeInteger(payload.expiresAt)
      || payload.expiresAt < nowSeconds
    ) {
      return null;
    }
    return { exportId: payload.exportId, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
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
