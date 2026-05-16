import { describe, expect, it } from "vitest";
import { createGameToken, normalizeRoomCode, verifyGameToken } from "../server.js";

const secret = "test-secret-with-enough-length-32";

describe("game tokens", () => {
  it("signs and verifies a short-lived game token", () => {
    const token = createGameToken({
      userId: "user-1",
      displayName: "Мила",
      roomCode: " ravn42 ",
      secret,
      ttlSeconds: 60,
    });

    const payload = verifyGameToken(token, secret);

    expect(payload.userId).toBe("user-1");
    expect(payload.displayName).toBe("Мила");
    expect(payload.roomCode).toBe("RAVN42");
  });

  it("rejects tampered tokens", () => {
    const token = createGameToken({
      userId: "user-1",
      displayName: "Мила",
      roomCode: "RAVN42",
      secret,
    });

    expect(() => verifyGameToken(`${token}x`, secret)).toThrow("Невалиден подпис");
  });

  it("rejects a token with a tampered payload", () => {
    const token = createGameToken({
      userId: "user-1",
      displayName: "Мила",
      roomCode: "RAVN42",
      secret,
    });
    const [payload, signature] = token.split(".");
    const parsed = JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8"));
    const tampered = `${Buffer.from(JSON.stringify({ ...parsed, userId: "hacker" }), "utf8").toString("base64url")}.${signature}`;

    expect(() => verifyGameToken(tampered, secret)).toThrow("Невалиден подпис");
  });

  it("rejects expired tokens", () => {
    const token = createGameToken({
      userId: "user-1",
      displayName: "Мила",
      roomCode: "RAVN42",
      secret,
      ttlSeconds: -10,
    });

    expect(() => verifyGameToken(token, secret)).toThrow("изтекъл");
  });

  it("rejects tokens for another room when an expected room is provided", () => {
    const token = createGameToken({
      userId: "user-1",
      displayName: "Мила",
      roomCode: "RAVN42",
      secret,
    });

    expect(() => verifyGameToken(token, secret, { roomCode: "OTHER1" })).toThrow("друга стая");
  });

  it("rejects tokens signed with another secret", () => {
    const token = createGameToken({
      userId: "user-1",
      displayName: "Мила",
      roomCode: "RAVN42",
      secret,
    });

    expect(() => verifyGameToken(token, "another-secret-with-enough-length")).toThrow("Невалиден подпис");
  });

  it("normalizes room codes", () => {
    expect(normalizeRoomCode(" ravn-42 ")).toBe("RAVN42");
  });
});
