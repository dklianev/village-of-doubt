import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface GameTokenPayload {
  userId: string;
  displayName: string;
  roomCode: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface CreateGameTokenInput {
  userId: string;
  displayName: string;
  roomCode: string;
  secret: string;
  ttlSeconds?: number;
}

const DEFAULT_TTL_SECONDS = 5 * 60;

export function createGameToken(input: CreateGameTokenInput): string {
  assertUsableSecret(input.secret);

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: GameTokenPayload = {
    userId: input.userId,
    displayName: input.displayName,
    roomCode: normalizeRoomCode(input.roomCode),
    issuedAt,
    expiresAt: issuedAt + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    nonce: randomUUID(),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, input.secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyGameToken(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): GameTokenPayload {
  assertUsableSecret(secret);

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

  if (parsed.expiresAt < nowSeconds) {
    throw new Error("Game token-ът е изтекъл.");
  }

  return {
    userId: parsed.userId,
    displayName: parsed.displayName,
    roomCode: normalizeRoomCode(parsed.roomCode),
    issuedAt: parsed.issuedAt,
    expiresAt: parsed.expiresAt,
    nonce: parsed.nonce,
  };
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
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
  if (secret.length < 16) {
    throw new Error("GAME_TOKEN_SECRET трябва да бъде поне 16 символа.");
  }
}
