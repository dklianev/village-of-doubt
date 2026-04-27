import { describe, expect, it } from "vitest";
import { createGameToken, normalizeRoomCode, verifyGameToken } from "../server.js";

const secret = "test-secret-with-enough-length";

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

  it("normalizes room codes", () => {
    expect(normalizeRoomCode(" ravn-42 ")).toBe("RAVN42");
  });
});
