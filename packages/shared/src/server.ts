import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  DEFAULT_AVATAR_ID,
  isAvatarId,
  type AvatarId,
} from "./avatar-catalog.js";
import { ROOM_CODE_REGEX, normalizeRoomCode } from "./room-code.js";

export { normalizeRoomCode } from "./room-code.js";

export interface GameTokenPayload {
  userId: string;
  displayName: string;
  avatarId: AvatarId;
  roomCode: string;
  issuedAt: number;
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

const DEFAULT_TTL_SECONDS = 5 * 60;
const MIN_SECRET_LENGTH = 32;

export function createGameToken(input: CreateGameTokenInput): string {
  assertUsableSecret(input.secret);

  if (input.avatarId !== undefined && !isAvatarId(input.avatarId)) {
    throw new Error("Невалиден портрет.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const roomCode = requireCanonicalRoomCode(input.roomCode);
  const payload: GameTokenPayload = {
    userId: input.userId,
    displayName: input.displayName,
    avatarId: input.avatarId ?? DEFAULT_AVATAR_ID,
    roomCode,
    issuedAt,
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
