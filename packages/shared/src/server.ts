import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  DEFAULT_AVATAR_ID,
  isAvatarId,
  type AvatarId,
} from "./avatar-catalog.js";
import { ROOM_CODE_REGEX, normalizeRoomCode } from "./room-code.js";

export { normalizeRoomCode } from "./room-code.js";

export const GAME_SESSION_REVOCATION_CHANNEL = "wm:security:game-session-revoked:v1";

export function gameSessionRevocationKey(userId: string) {
  if (!isSafeOperationalUserId(userId)) {
    throw new Error("Невалиден потребител за прекратяване на сесия.");
  }
  return `wm:security:game-session-revoked:${createHmac("sha256", "game-session-revocation-key-v1").update(userId).digest("hex")}`;
}

export function createGameSessionRevocationMessage(userId: string, revokedAtMs = Date.now()) {
  if (!isSafeOperationalUserId(userId)) {
    throw new Error("Невалиден потребител за прекратяване на сесия.");
  }
  if (!Number.isSafeInteger(revokedAtMs) || revokedAtMs < 0) {
    throw new Error("Невалиден момент за прекратяване на сесия.");
  }
  return JSON.stringify({ version: 1, userId, revokedAtMs });
}

export function parseGameSessionRevocationMessage(value: string): { userId: string; revokedAtMs: number } | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed.version === 1
      && isSafeOperationalUserId(parsed.userId)
      && typeof parsed.revokedAtMs === "number"
      && Number.isSafeInteger(parsed.revokedAtMs)
      && parsed.revokedAtMs >= 0
      ? { userId: parsed.userId, revokedAtMs: parsed.revokedAtMs }
      : null;
  } catch {
    return null;
  }
}

function isSafeOperationalUserId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);
}

export function resolveRedisUrl(redisUrl: string, passwordFile?: string): string {
  if (!passwordFile) {
    return redisUrl;
  }

  const password = readFileSync(passwordFile, "utf8").trim();
  if (!password) {
    throw new Error("Redis тайната е празна.");
  }

  const resolved = new URL(redisUrl);
  resolved.username ||= "default";
  resolved.password = password;
  return resolved.toString();
}

export interface GameTokenPayload {
  userId: string;
  displayName: string;
  avatarId: AvatarId;
  roomCode: string;
  issuedAt: number;
  issuedAtMs: number;
  expiresAt: number;
  nonce: string;
}

export interface CreateGameTokenInput {
  userId: string;
  displayName: string;
  avatarId?: string;
  roomCode: string;
  secret: string;
  ttlSeconds?: number;
}

export interface VerifyGameTokenOptions {
  roomCode?: string;
  nowSeconds?: number;
}

const ROOM_PREVIEW_CREDENTIAL_CONTEXT = "room-preview:v1";

export function createRoomPreviewCredential(roomCode: string, secret: string): string {
  assertUsableSecret(secret);
  return createHmac("sha256", secret)
    .update(`${ROOM_PREVIEW_CREDENTIAL_CONTEXT}:${requireCanonicalRoomCode(roomCode)}`)
    .digest("base64url");
}

export function verifyRoomPreviewCredential(roomCode: string, credential: string, secret: string): boolean {
  if (!credential) {
    return false;
  }
  try {
    return safeEqual(credential, createRoomPreviewCredential(roomCode, secret));
  } catch {
    return false;
  }
}

const DEFAULT_TTL_SECONDS = 5 * 60;
const MIN_SECRET_LENGTH = 32;

export function createGameToken(input: CreateGameTokenInput): string {
  assertUsableSecret(input.secret);

  if (input.avatarId !== undefined && !isAvatarId(input.avatarId)) {
    throw new Error("Невалиден портрет.");
  }

  const issuedAtMs = Date.now();
  const issuedAt = Math.floor(issuedAtMs / 1000);
  const roomCode = requireCanonicalRoomCode(input.roomCode);
  const payload: GameTokenPayload = {
    userId: input.userId,
    displayName: input.displayName,
    avatarId: input.avatarId ?? DEFAULT_AVATAR_ID,
    roomCode,
    issuedAt,
    issuedAtMs,
    expiresAt: issuedAt + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    nonce: randomUUID(),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, input.secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyGameToken(
  token: string,
  secret: string,
  optionsOrNowSeconds: VerifyGameTokenOptions | number = {},
): GameTokenPayload {
  assertUsableSecret(secret);
  const nowSeconds =
    typeof optionsOrNowSeconds === "number" ? optionsOrNowSeconds : (optionsOrNowSeconds.nowSeconds ?? Math.floor(Date.now() / 1000));
  const expectedRoomCode = typeof optionsOrNowSeconds === "number" ? undefined : optionsOrNowSeconds.roomCode;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Невалиден game token.");
  }

  const expectedSignature = sign(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new Error("Невалиден подпис на game token.");
  }

  const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<GameTokenPayload>;
  if (
    typeof parsed.userId !== "string" ||
    typeof parsed.displayName !== "string" ||
    typeof parsed.roomCode !== "string" ||
    typeof parsed.issuedAt !== "number" ||
    typeof parsed.expiresAt !== "number" ||
    typeof parsed.nonce !== "string"
  ) {
    throw new Error("Невалидно съдържание на game token.");
  }

  if (parsed.issuedAtMs !== undefined && (!Number.isSafeInteger(parsed.issuedAtMs) || parsed.issuedAtMs < 0)) {
    throw new Error("Невалидно време в game token.");
  }

  if (parsed.avatarId !== undefined && !isAvatarId(parsed.avatarId)) {
    throw new Error("Невалиден портрет в game token.");
  }

  if (parsed.expiresAt < nowSeconds) {
    throw new Error("Game token-ът е изтекъл.");
  }

  const roomCode = requireCanonicalRoomCode(parsed.roomCode);
  if (expectedRoomCode && roomCode !== normalizeRoomCode(expectedRoomCode)) {
    throw new Error("Game token-ът е за друга стая.");
  }

  return {
    userId: parsed.userId,
    displayName: parsed.displayName,
    avatarId: parsed.avatarId ?? DEFAULT_AVATAR_ID,
    roomCode,
    issuedAt: parsed.issuedAt,
    issuedAtMs: parsed.issuedAtMs ?? parsed.issuedAt * 1_000,
    expiresAt: parsed.expiresAt,
    nonce: parsed.nonce,
  };
}

function requireCanonicalRoomCode(code: string): string {
  const normalizedCode = normalizeRoomCode(code);
  if (!ROOM_CODE_REGEX.test(normalizedCode)) {
    throw new Error("Невалиден код на стая.");
  }
  return normalizedCode;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function assertUsableSecret(secret: string): void {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`GAME_TOKEN_SECRET трябва да бъде поне ${MIN_SECRET_LENGTH} символа.`);
  }
}
